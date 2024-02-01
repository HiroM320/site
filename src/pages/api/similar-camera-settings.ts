import type { APIRoute } from "astro";

import * as v from "valibot";
import { parse } from "node-html-parser";

import cameraSettingsValues from "@/assets/camera_settings_values.json";

// https://liquipedia.net/rocketleague/api.php?page=List_of_player_camera_settings&format=json&formatversion=2&utf8=true&action=parse&prop=text
// Astro フロントマターでフェッチするので十分と判断している
import dummyJson from "@/assets/list_of_player_camera_settings.json";

export const GET: APIRoute = async ({ url }) => {
  // クエリストリングからデータ取得
  const requestParams = Object.fromEntries(url.searchParams.entries());

  // リクエスト値を変換してバリデーション
  const requestCameraSettings = v.parse(cameraSettingsSchema, {
    cameraShake: Number(requestParams.cameraShake),
    fov: Number(requestParams.fov),
    height: Number(requestParams.height),
    angle: Number(requestParams.angle),
    distance: Number(requestParams.distance),
    stiffness: Number(requestParams.stiffness),
    swivelSpeed: Number(requestParams.swivelSpeed),
    transitionSpeed: Number(requestParams.transitionSpeed),
    ballCamera: Number(requestParams.ballCamera),
  });

  // リクエスト値を標準化
  const normalizedInputs = calcNormalizedCameraSettings(requestCameraSettings);

  // プロプレイヤーのカメラ設定一覧を読み取る
  const rawMwContentText = dummyJson["parse"]["text"];
  const parsedMwContentText = parse(rawMwContentText);
  const rows = parsedMwContentText.querySelectorAll(
    "div.mw-parser-output table.sortable tbody tr"
  );

  // 最初のエレメントは th なので削除
  const headers = rows.shift();

  /*
  example of a row:
  ```
  <tr>
    <td data-label="Player" class="rl-responsive-table-sortable-left-align">
      <span class="flag">
        <img alt="United States" src="/commons/images/thumb/3/3b/Us_hd.png/36px-Us_hd.png" decoding="async" title="United States" width="36" height="24" srcset="/commons/images/thumb/3/3b/Us_hd.png/54px-Us_hd.png 1.5x, /commons/images/thumb/3/3b/Us_hd.png/72px-Us_hd.png 2x" >
      </span>
      <b>
        <a href="/rocketleague/0ver_Zer0" title="0ver Zer0">0ver Zer0</a>
      </b>
    </td>
    <td data-label="Team" class="rl-responsive-table-sortable-left-align">
    </td>
    <td data-label="Camera shake">No
    </td>
    <td data-label="FOV">110
    </td>
    <td data-label="Height">90
    </td>
    <td data-label="Angle">-4.0
    </td>
    <td data-label="Distance">270
    </td>
    <td data-label="Stiffness">0.65
    </td>
    <td data-label="Swivel speed">7.50
    </td>
    <td data-label="Transition speed">1.70
    </td>
    <td data-label="Ball camera">Toggle
    </td>
    <td data-label="Last updated">2021-10-07
    </td>
  </tr>
  ```
  */
  const similarityLevelsMap = new Map<number, string[]>();
  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    const player = cells[0]?.querySelector("b a")?.innerText.trim();

    const ValidatedProCameraSettings = v.safeParse(cameraSettingsSchema, {
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

    if (!ValidatedProCameraSettings.success) {
      return;
    }

    const normalizedProCameraSettings = calcNormalizedCameraSettings(
      ValidatedProCameraSettings.output
    );

    const similarity = calcSimilarityBetweenNormalizedCameraSettings(
      normalizedInputs,
      normalizedProCameraSettings
    );

    const similaritySum = Object.values(similarity).reduce(
      (acc, cur) => acc + cur,
      0
    );

    similarityLevelsMap.set(similaritySum, [
      player ?? "プレイヤー名が取得できませんでした",
      ...(similarityLevelsMap.get(similaritySum) ?? []),
    ]);
  });

  const sortedSimilarityLevels = [...similarityLevelsMap].sort();

  return new Response(
    JSON.stringify({
      mostSimilarPlayers: sortedSimilarityLevels.at(0)?.[1] ?? [],
      mostDissimilarPlayers: sortedSimilarityLevels.at(-1)?.[1] ?? [],
    })
  );
};

const cameraSettingsSchema = v.object({
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

type CameraSettings = v.Output<typeof cameraSettingsSchema>;

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

const calcNormalizedCameraSettings: CalcNormalizedCameraSettings = ({
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
