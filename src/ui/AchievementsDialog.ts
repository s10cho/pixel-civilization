import { t, tKey } from '../i18n';
import type { AchievementProgress } from '../progression/achievements';
import { el } from './dom';
import { formatAmount } from './format';
import { icon } from './icons';
import { Modal } from './Modal';

/** The city's milestones: what it has reached, and how far along the rest are. */
export function openAchievements(root: HTMLElement, achievements: readonly AchievementProgress[]): Modal {
  const done = achievements.filter((achievement) => achievement.unlocked).length;
  const body = el('div', 'achievements');
  body.append(el('p', 'modal-text', t('achievements.count', { done, total: achievements.length })));

  for (const achievement of achievements) {
    const row = el('div', 'achievement');
    row.dataset.state = achievement.unlocked ? 'done' : 'open';
    row.append(icon(achievement.unlocked ? 'trophy' : 'sparkles', 'achievement-icon'));

    const text = el('div', 'achievement-text');
    text.append(
      el('div', 'achievement-name', tKey(`achievement.${achievement.id}.name`)),
      el('div', 'achievement-desc', tKey(`achievement.${achievement.id}.desc`)),
    );
    if (!achievement.unlocked) {
      const track = el('div', 'progress');
      const fill = el('div', 'progress-fill');
      fill.style.width = `${Math.min(100, (achievement.current / achievement.target) * 100)}%`;
      track.append(fill);
      text.append(track);
    }
    row.append(text);

    const side = el('div', 'achievement-side');
    side.append(
      el(
        'div',
        'achievement-progress',
        achievement.unlocked
          ? t('achievements.done')
          : `${formatAmount(achievement.current)} / ${formatAmount(achievement.target)}`,
      ),
    );
    if (achievement.rewardGold > 0) {
      side.append(el('div', 'achievement-reward', t('achievements.reward', { gold: formatAmount(achievement.rewardGold) })));
    }
    row.append(side);
    body.append(row);
  }

  return new Modal(root, {
    title: t('achievements.title'),
    icon: 'trophy',
    body,
    actions: [{ label: t('achievements.close'), variant: 'primary' }],
  });
}
