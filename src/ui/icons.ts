import arrowUp from 'pixelarticons/svg/arrow-up.svg?raw';
import building from 'pixelarticons/svg/building.svg?raw';
import close from 'pixelarticons/svg/close.svg?raw';
import coins from 'pixelarticons/svg/coins.svg?raw';
import expand from 'pixelarticons/svg/expand.svg?raw';
import home from 'pixelarticons/svg/home.svg?raw';
import menu from 'pixelarticons/svg/menu.svg?raw';
import smile from 'pixelarticons/svg/smile.svg?raw';
import store from 'pixelarticons/svg/store.svg?raw';
import tree from 'pixelarticons/svg/tree.svg?raw';
import users from 'pixelarticons/svg/users.svg?raw';
import zap from 'pixelarticons/svg/zap.svg?raw';
import type { BuildingType } from '../building/types';

/** Pixel-art icons from pixelarticons (MIT), bundled as inline SVG strings. */
const ICONS = { arrowUp, building, close, coins, expand, home, menu, smile, store, tree, users, zap };

export type IconName = keyof typeof ICONS;

export const BUILDING_ICONS: Record<BuildingType, IconName> = {
  townHall: 'building',
  house: 'home',
  shop: 'store',
  park: 'tree',
};

/** Inline SVG icon; coloured through CSS `color` (the SVGs use currentColor). */
export function icon(name: IconName, className?: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className ? `icon ${className}` : 'icon';
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = ICONS[name];
  return node;
}
