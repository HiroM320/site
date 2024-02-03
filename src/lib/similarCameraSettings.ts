import * as v from "valibot";
import { parse } from "node-html-parser";

import cameraSettingsValues from "@/assets/camera_settings_values.json";

const rawProCameraSettingsJsonSchema = v.object({
  parse: v.object({
    title: v.literal(
      "List of player camera settings",
      "タイトルが変わっている可能性が高い"
    ),
    pageid: v.literal(2448, "ページIDが変わっている可能性が高い"),
    text: v.string(),
  }),
});

type RawProCameraSettingsJson = v.Output<typeof rawProCameraSettingsJsonSchema>;

export const getProCameraSettings = async () => {
  const proCameraSettingsJson = await fetchRawProCameraSettings();
  const proCameraSettings = parseProCameraSettings(proCameraSettingsJson);
  return proCameraSettings;
};

const fetchRawProCameraSettings =
  async (): Promise<RawProCameraSettingsJson> => {
    const res = await fetch(
      "https://liquipedia.net/rocketleague/api.php?page=List_of_player_camera_settings&format=json&formatversion=2&utf8=true&action=parse&prop=text"
    );
    const rawProCameraSettingsJson = v.parse(
      rawProCameraSettingsJsonSchema,
      await res.json()
    );
    return rawProCameraSettingsJson;
  };

const parseProCameraSettings = (
  proCameraSettingsJson: RawProCameraSettingsJson
): Record<string, CameraSettings> => {
  // プロプレイヤーのカメラ設定一覧を読み取る
  const rawMwContentText = proCameraSettingsJson["parse"]["text"];
  const parsedMwContentText = parse(rawMwContentText);
  const rows = parsedMwContentText.querySelectorAll(
    "div.mw-parser-output table.sortable tbody tr"
  );

  // 最初の要素は th なので削除
  // 順序変更対策するなら、この th を参照するように変更する
  rows.shift();

  // map では無効な値を除去できない（undefinedが入ってしまう）ので、対策として flatMap を使用
  const proCameraSettings = rows.reduce((acc, row) => {
    const cells = row.querySelectorAll("td");

    const player = cells[0]?.querySelector("b a")?.innerText.trim();
    if (!player) {
      return acc;
    }

    const validatedProCameraSettings = v.safeParse(cameraSettingsSchema, {
      cameraShake: cells[2]?.innerText.trim() === "No" ? 0 : 1,
      fov: Number(cells[3]?.innerText.trim()),
      height: Number(cells[4]?.innerText.trim()),
      angle: Number(cells[5]?.innerText.trim()),
      distance: Number(cells[6]?.innerText.trim()),
      stiffness: Number(cells[7]?.innerText.trim()),
      swivelSpeed: Number(cells[8]?.innerText.trim()),
      transitionSpeed: Number(cells[9]?.innerText.trim()),
      ballCamera: cells[10]?.innerText.trim() === "Toggle" ? 0 : 1,
    });
    if (!validatedProCameraSettings.success) {
      return acc;
    }

    return { ...acc, [player]: validatedProCameraSettings.output };
  }, {});

  return proCameraSettings;
};

export const calcSimilarityBetweenProCameraSettings = (
  target: CameraSettings,
  proCameraSettings: Record<string, CameraSettings>
) => {
  const normalizedTarget = normalizeCameraSettings(target);
  const normalizedProCameraSettings = Object.fromEntries(
    Object.entries(proCameraSettings).map(([player, proCameraSetting]) => {
      return [player, normalizeCameraSettings(proCameraSetting)];
    })
  );

  const similarityProMap = new Map<number, string[]>();
  Object.entries(normalizedProCameraSettings).forEach(
    ([player, normalizedProCameraSetting]) => {
      const similarity = calcSimilarityBetweenNormalizedCameraSettings(
        normalizedTarget,
        normalizedProCameraSetting
      );

      const similaritySum = Object.values(similarity).reduce(
        (acc, cur) => acc + cur,
        0
      );

      similarityProMap.set(similaritySum, [
        ...(similarityProMap.get(similaritySum) ?? []),
        player,
      ]);
    }
  );

  const sortedSimilarityProEntries = [...similarityProMap].sort();

  return sortedSimilarityProEntries;
};

export const cameraSettingsSchema = v.object({
  cameraShake: v.union([v.literal(0), v.literal(1)]),
  fov: v.number([
    v.minValue(cameraSettingsValues["fov"]["min"]),
    v.maxValue(cameraSettingsValues["fov"]["max"]),
  ]),
  height: v.number([
    v.minValue(cameraSettingsValues["height"]["min"]),
    v.maxValue(cameraSettingsValues["height"]["max"]),
  ]),
  angle: v.number([
    v.minValue(cameraSettingsValues["angle"]["min"]),
    v.maxValue(cameraSettingsValues["angle"]["max"]),
  ]),
  distance: v.number([
    v.minValue(cameraSettingsValues["distance"]["min"]),
    v.maxValue(cameraSettingsValues["distance"]["max"]),
  ]),
  stiffness: v.number([
    v.minValue(cameraSettingsValues["stiffness"]["min"]),
    v.maxValue(cameraSettingsValues["stiffness"]["max"]),
  ]),
  swivelSpeed: v.number([
    v.minValue(cameraSettingsValues["swivelSpeed"]["min"]),
    v.maxValue(cameraSettingsValues["swivelSpeed"]["max"]),
  ]),
  transitionSpeed: v.number([
    v.minValue(cameraSettingsValues["transitionSpeed"]["min"]),
    v.maxValue(cameraSettingsValues["transitionSpeed"]["max"]),
  ]),
  ballCamera: v.union([v.literal(0), v.literal(1)]),
});

export type CameraSettings = v.Output<typeof cameraSettingsSchema>;

const normalizedCameraSettingsSchema = v.object({
  cameraShake: v.union([v.literal(0), v.literal(1)]),
  fov: v.number([v.minValue(0), v.maxValue(1)]),
  height: v.number([v.minValue(0), v.maxValue(1)]),
  angle: v.number([v.minValue(0), v.maxValue(1)]),
  distance: v.number([v.minValue(0), v.maxValue(1)]),
  stiffness: v.number([v.minValue(0), v.maxValue(1)]),
  swivelSpeed: v.number([v.minValue(0), v.maxValue(1)]),
  transitionSpeed: v.number([v.minValue(0), v.maxValue(1)]),
  ballCamera: v.union([v.literal(0), v.literal(1)]),
});

type NormalizedCameraSettings = v.Output<typeof normalizedCameraSettingsSchema>;

type CalcNormalizedCameraSettings = (
  settings: CameraSettings
) => NormalizedCameraSettings;

const normalizeCameraSettings: CalcNormalizedCameraSettings = ({
  cameraShake,
  fov,
  height,
  angle,
  distance,
  stiffness,
  swivelSpeed,
  transitionSpeed,
  ballCamera,
}) => {
  const normalizedCameraShake = cameraShake;
  const normalizedFov =
    (fov - cameraSettingsValues["fov"]["min"]) /
    (cameraSettingsValues["fov"]["max"] - cameraSettingsValues["fov"]["min"]);
  const normalizedHeight =
    (height - cameraSettingsValues["height"]["min"]) /
    (cameraSettingsValues["height"]["max"] -
      cameraSettingsValues["height"]["min"]);
  const normalizedAngle =
    (angle - cameraSettingsValues["angle"]["min"]) /
    (cameraSettingsValues["angle"]["max"] -
      cameraSettingsValues["angle"]["min"]);
  const normalizedDistance =
    (distance - cameraSettingsValues["distance"]["min"]) /
    (cameraSettingsValues["distance"]["max"] -
      cameraSettingsValues["distance"]["min"]);
  const normalizedStiffness =
    (stiffness - cameraSettingsValues["stiffness"]["min"]) /
    (cameraSettingsValues["stiffness"]["max"] -
      cameraSettingsValues["stiffness"]["min"]);
  const normalizedSwivelSpeed =
    (swivelSpeed - cameraSettingsValues["swivelSpeed"]["min"]) /
    (cameraSettingsValues["swivelSpeed"]["max"] -
      cameraSettingsValues["swivelSpeed"]["min"]);
  const normalizedTransitionSpeed =
    (transitionSpeed - cameraSettingsValues["transitionSpeed"]["min"]) /
    (cameraSettingsValues["transitionSpeed"]["max"] -
      cameraSettingsValues["transitionSpeed"]["min"]);
  const normalizedBallCamera = ballCamera;

  return {
    cameraShake: normalizedCameraShake,
    fov: normalizedFov,
    height: normalizedHeight,
    angle: normalizedAngle,
    distance: normalizedDistance,
    stiffness: normalizedStiffness,
    swivelSpeed: normalizedSwivelSpeed,
    transitionSpeed: normalizedTransitionSpeed,
    ballCamera: normalizedBallCamera,
  };
};

/** 0 に近いほど似ている */
type CalcSimilarityBetweenNormalizedCameraSettings = (
  a: CameraSettings,
  b: CameraSettings
) => NormalizedCameraSettings;

const calcSimilarityBetweenNormalizedCameraSettings: CalcSimilarityBetweenNormalizedCameraSettings =
  (a, b) => {
    const cameraShake = Math.abs(a.cameraShake - b.cameraShake);
    const fov = Math.abs(a.fov - b.fov);
    const height = Math.abs(a.height - b.height);
    const angle = Math.abs(a.angle - b.angle);
    const distance = Math.abs(a.distance - b.distance);
    const stiffness = Math.abs(a.stiffness - b.stiffness);
    const swivelSpeed = Math.abs(a.swivelSpeed - b.swivelSpeed);
    const transitionSpeed = Math.abs(a.transitionSpeed - b.transitionSpeed);
    const ballCamera = Math.abs(a.ballCamera - b.ballCamera);

    return v.parse(normalizedCameraSettingsSchema, {
      cameraShake,
      fov,
      height,
      angle,
      distance,
      stiffness,
      swivelSpeed,
      transitionSpeed,
      ballCamera,
    });
  };
