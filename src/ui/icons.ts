import arrowUp from 'lucide-static/icons/arrow-up.svg?raw';
import coins from 'lucide-static/icons/coins.svg?raw';
import expand from 'lucide-static/icons/expand.svg?raw';
import factory from 'lucide-static/icons/factory.svg?raw';
import flask from 'lucide-static/icons/flask-conical.svg?raw';
import gauge from 'lucide-static/icons/gauge.svg?raw';
import home from 'lucide-static/icons/house.svg?raw';
import building from 'lucide-static/icons/landmark.svg?raw';
import menu from 'lucide-static/icons/menu.svg?raw';
import move from 'lucide-static/icons/move.svg?raw';
import smile from 'lucide-static/icons/smile.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import store from 'lucide-static/icons/store.svg?raw';
import tree from 'lucide-static/icons/trees.svg?raw';
import alert from 'lucide-static/icons/triangle-alert.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import close from 'lucide-static/icons/x.svg?raw';
import zap from 'lucide-static/icons/zap.svg?raw';
import type { BuildingType } from '../building/types';

/** Rounded line icons from Lucide (ISC), bundled as inline SVG strings. */
const ICONS = {
  alert,
  arrowUp,
  building,
  close,
  coins,
  expand,
  factory,
  flask,
  gauge,
  home,
  menu,
  move,
  smile,
  sparkles,
  store,
  tree,
  users,
  zap,
};

export type IconName = keyof typeof ICONS;

export const BUILDING_ICONS: Record<BuildingType, IconName> = {
  townHall: 'building',
  house: 'home',
  shop: 'store',
  park: 'tree',
  powerPlant: 'zap',
  researchCenter: 'flask',
  factory: 'factory',
};

/** Inline SVG icon; coloured through CSS `color` (the SVGs stroke with currentColor). */
export function icon(name: IconName, className?: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className ? `icon ${className}` : 'icon';
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = ICONS[name];
  return node;
}
