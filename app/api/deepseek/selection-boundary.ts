const chineseNumber = (value: string) => {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9};
  if (value === "十") return 10;
  const ten = value.indexOf("十");
  if (ten >= 0) return (ten === 0 ? 1 : digits[value[ten - 1]] || 0) * 10 + (ten === value.length - 1 ? 0 : digits[value[ten + 1]] || 0);
  return digits[value] || NaN;
};

const shotMarkers = (value: string) => {
  const marker = /【\s*分镜\s*([0-9一二三四五六七八九十〇零]+)\s*】/g;
  return [...value.matchAll(marker)].map((match) => ({
    number: chineseNumber(match[1]),
    index: match.index || 0,
  }));
};

export const constrainSelectionReplacement = (
  replacement: string,
  original: string,
  options: {allowShotExpansion?: boolean} = {},
) => {
  const source = replacement.trim();
  if (!source) throw new Error("模型没有返回局部替换文本。");
  const originalTrimmed = original.trim();
  const expectedMarkers = shotMarkers(originalTrimmed);
  const returnedMarkers = shotMarkers(source);

  if (options.allowShotExpansion) {
    if (returnedMarkers.length <= expectedMarkers.length) {
      throw new Error("模型没有按要求新增分镜。");
    }
    return {replacement: source, cropped: false};
  }

  if (!expectedMarkers.length) {
    if (returnedMarkers.length) throw new Error("模型在局部文字选区中新增了分镜标题。");
    return {replacement: source, cropped: false};
  }

  const expectedNumbers = expectedMarkers.map((marker) => marker.number);
  const expectedSet = new Set(expectedNumbers);
  const startsAtShotBoundary = expectedMarkers[0].index === 0;
  let candidate = source;

  if (startsAtShotBoundary) {
    const firstExpected = returnedMarkers.find((marker) => marker.number === expectedNumbers[0]);
    if (!firstExpected) throw new Error("模型返回结果缺少选区起始分镜。");
    const firstOutside = returnedMarkers.find((marker) => marker.index > firstExpected.index && !expectedSet.has(marker.number));
    candidate = source.slice(firstExpected.index, firstOutside?.index ?? source.length).trim();
  }

  const candidateNumbers = shotMarkers(candidate).map((marker) => marker.number);
  if (candidateNumbers.length !== expectedNumbers.length || candidateNumbers.some((number, index) => number !== expectedNumbers[index])) {
    throw new Error("模型返回的分镜范围与选区不一致。");
  }
  return {replacement: candidate, cropped: candidate !== source};
};
