/**
 * The French dictionary: English sentence -> French sentence.
 * Split by area so each file stays readable.
 */
import { common } from "./common";
import { pages } from "./pages";
import { auth } from "./auth";
import { trade } from "./trade";
import { money } from "./money";
import { messages } from "./messages";
import { pickup } from "./pickup";

export const FR: Record<string, string> = {
  ...common, ...pages, ...auth, ...trade, ...money, ...messages, ...pickup,
};
