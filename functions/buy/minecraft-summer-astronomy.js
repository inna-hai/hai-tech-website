import { redirectToMinecraftSummerCheckout } from './_minecraft-summer.js';

export async function onRequestGet(context) {
  return redirectToMinecraftSummerCheckout('astronomy', context);
}
