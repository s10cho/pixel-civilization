import arrowLeft from 'lucide-static/icons/arrow-left.svg?raw';
import bed from 'lucide-static/icons/bed.svg?raw';
import arrowUp from 'lucide-static/icons/arrow-up.svg?raw';
import clock from 'lucide-static/icons/clock.svg?raw';
import coins from 'lucide-static/icons/coins.svg?raw';
import expand from 'lucide-static/icons/expand.svg?raw';
import droplets from 'lucide-static/icons/droplets.svg?raw';
import factory from 'lucide-static/icons/factory.svg?raw';
import flag from 'lucide-static/icons/flag.svg?raw';
import flask from 'lucide-static/icons/flask-conical.svg?raw';
import folder from 'lucide-static/icons/folder-open.svg?raw';
import gauge from 'lucide-static/icons/gauge.svg?raw';
import hammer from 'lucide-static/icons/hammer.svg?raw';
import home from 'lucide-static/icons/house.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import building from 'lucide-static/icons/landmark.svg?raw';
import lightbulb from 'lucide-static/icons/lightbulb.svg?raw';
import menu from 'lucide-static/icons/menu.svg?raw';
import move from 'lucide-static/icons/move.svg?raw';
import pause from 'lucide-static/icons/pause.svg?raw';
import play from 'lucide-static/icons/play.svg?raw';
import plus from 'lucide-static/icons/plus.svg?raw';
import route from 'lucide-static/icons/route.svg?raw';
import settings from 'lucide-static/icons/settings.svg?raw';
import smile from 'lucide-static/icons/smile.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import store from 'lucide-static/icons/store.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import tree from 'lucide-static/icons/trees.svg?raw';
import trophy from 'lucide-static/icons/trophy.svg?raw';
import alert from 'lucide-static/icons/triangle-alert.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import wheat from 'lucide-static/icons/wheat.svg?raw';
import volume from 'lucide-static/icons/volume-2.svg?raw';
import close from 'lucide-static/icons/x.svg?raw';
import zap from 'lucide-static/icons/zap.svg?raw';
import { BUILDINGS } from '../config/balance';
import type { BuildingCategory, BuildingType } from '../building/types';

/** Rounded line icons from Lucide (ISC), bundled as inline SVG strings. */
const ICONS = {
  alert,
  arrowLeft,
  arrowUp,
  bed,
  building,
  clock,
  close,
  coins,
  droplets,
  expand,
  factory,
  flag,
  flask,
  folder,
  gauge,
  hammer,
  home,
  info,
  lightbulb,
  menu,
  move,
  pause,
  play,
  plus,
  route,
  settings,
  smile,
  sparkles,
  store,
  trash,
  tree,
  trophy,
  users,
  volume,
  wheat,
  zap,
};

export type IconName = keyof typeof ICONS;

/** Default icon per build-menu category, so every building has one without extra work. */
const CATEGORY_ICONS: Record<BuildingCategory, IconName> = {
  housing: 'home',
  food: 'wheat',
  commerce: 'store',
  industry: 'hammer',
  energy: 'zap',
  utility: 'droplets',
  transport: 'route',
  leisure: 'tree',
  culture: 'flag',
  science: 'flask',
  civic: 'building',
};

/** Buildings distinctive enough to deserve their own icon. */
const ICON_OVERRIDES: Partial<Record<BuildingType, IconName>> = {
  townHall: 'building',
  inn: 'bed',
  factory: 'factory',
  monument: 'flag',
  road: 'route',
};

export const BUILDING_ICONS = Object.fromEntries(
  (Object.keys(BUILDINGS) as BuildingType[]).map((type) => [
    type,
    ICON_OVERRIDES[type] ?? CATEGORY_ICONS[BUILDINGS[type].category],
  ]),
) as Record<BuildingType, IconName>;

/** Inline SVG icon; coloured through CSS `color` (the SVGs stroke with currentColor). */
export function icon(name: IconName, className?: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className ? `icon ${className}` : 'icon';
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = ICONS[name];
  return node;
}
