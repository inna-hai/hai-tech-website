import { minecraftSummerHandler } from './_minecraft-summer.js';

export async function onRequestGet(context) {
  return minecraftSummerHandler('astronomy', context);
}

export async function onRequestPost(context) {
  return minecraftSummerHandler('astronomy', context);
}
