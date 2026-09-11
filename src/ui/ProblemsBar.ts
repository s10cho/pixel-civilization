import type { CityProblem, ProblemKind } from '../economy/problems';
import { button, el } from './dom';
import { problemText } from './messages';

/** Warning chips for current city problems; tapping one shows where it is. */
export class ProblemsBar {
  readonly element = el('div', 'problems');
  private rendered = '';

  constructor(private readonly onFocus: (kind: ProblemKind) => void) {}

  update(problems: readonly CityProblem[]): void {
    const texts = problems.map((problem) => problemText(problem));
    const signature = texts.join('|');
    if (signature === this.rendered) return;
    this.rendered = signature;

    this.element.replaceChildren(
      ...problems.map((problem, i) => {
        const chip = button({
          icon: 'alert',
          label: texts[i],
          className: 'problem-chip',
          onClick: () => this.onFocus(problem.kind),
        });
        chip.dataset.problem = problem.kind;
        return chip;
      }),
    );
  }
}
