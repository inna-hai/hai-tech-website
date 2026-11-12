import { minecraftSummerHandler } from './_minecraft-summer.js';

export async function onRequestGet(context) {
  return minecraftSummerHandler('math', context);
}

export async function onRequestPost(context) {
  return minecraftSummerHandler('math', context);
}
