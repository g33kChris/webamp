import { xml2js } from "xml-js";

export function getCaseInsensitveFile(zip, filename) {
  // TODO: Escape `file` for rejex characters
  return zip.file(new RegExp(filename, "i"))[0];
}

// Read a
export async function readXml(zip, filepath) {
  const file = await getCaseInsensitveFile(zip, filepath);
  if (file == null) {
    return null;
  }
  const text = await file.async("text");
  return xml2js(text, { compact: false, elementsKey: "children" });
}

export async function readUint8array(zip, filepath) {
  const file = await getCaseInsensitveFile(zip, filepath);
  if (file == null) {
    return null;
  }
  return file.async("uint8array");
}

// I any of the values in `arr` are themselves arrays, interpolate the nested
// array into the top level array.
function flatten(arr) {
  const newArr = [];
  arr.forEach(item => {
    if (Array.isArray(item)) {
      newArr.push(...item);
    } else {
      newArr.push(item);
    }
  });
  return newArr;
}

// Map an async function over an array. If the value returned from the mapper is
// an array, it recursively maps the function over that array's values, and then
// interpoates the resulting flat array into the top level array of results.
export async function asyncFlatMap(arr, mapper) {
  const mapped = await Promise.all(arr.map(mapper));
  const childPromises = mapped.map(async item => {
    if (Array.isArray(item)) {
      return await asyncFlatMap(item, mapper);
    } else {
      return item;
    }
  });
  return flatten(await Promise.all(childPromises));
}

// Apply a mapper function to all nodes in a tree using `asyncFlatMap`. This
// allows mapper to conditionally return either a single node, or an array of
// nodes.
//
// The tree should have the form of objects nodes, each of which may
// have a property `children` which is an array of nodes.
//
// Note: The root node will not be transformed by the mapper, since the mapper
// could potentially return multiple nodes.
export async function asyncTreeFlatMap(node, mapper) {
  const { children } = node;
  if (children == null) {
    return node;
  }

  const mappedChildren = await asyncFlatMap(children, mapper);

  const recursedChildren = await Promise.all(
    mappedChildren.map(child => asyncTreeFlatMap(child, mapper))
  );

  return { ...node, children: recursedChildren };
}

// Given an XML file and a zip which it came from, replace all `<inline />` elements
// with the contents of the file to be included.
export async function inlineIncludes(xml, zip) {
  return asyncTreeFlatMap(xml, async node => {
    if (node.name !== "include") {
      return node;
    }
    // TODO: Normalize file names so that they hit the same cache
    const includedFile = await readXml(zip, node.attributes.file);
    if (includedFile == null) {
      console.warn(
        `Tried to include a file that could not be found: ${
          node.attributes.file
        }`
      );
      return node;
    }
    return includedFile.children;
  });
}
