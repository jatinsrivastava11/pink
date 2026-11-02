#!/usr/bin/env python3
"""
contribute.py — Spread real project commits and historical activity commits
across the last 12 months, and push to the configured GitHub repository.

Example usage:
  python3 contribute.py --repository=https://github.com/jatinsrivastava11/pink.git
"""

import argparse
from datetime import datetime, timedelta
import os
from random import randint, seed
from subprocess import Popen
import sys


def run(commands, env=None):
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    p = Popen(commands, env=merged_env)
    p.wait()
    if p.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(commands)}")


def message(date):
    return date.strftime("Contribution: %Y-%m-%d %H:%M")


def contribute(date, filename="README.md"):
    with open(os.path.join(os.getcwd(), filename), "a", encoding="utf-8") as f:
        f.write(message(date) + "\n\n")
    run(["git", "add", filename])
    iso = date.strftime("%Y-%m-%d %H:%M:%S")
    env = {
        "GIT_AUTHOR_DATE": iso,
        "GIT_COMMITTER_DATE": iso,
    }
    run(["git", "commit", "-m", f'"{message(date)}"'], env=env)


def commit_stage(paths, msg, date):
    existing = [p for p in paths if os.path.exists(p)]
    if not existing:
        return
    run(["git", "add"] + existing)
    # Check if anything is staged
    chk = Popen(["git", "diff", "--cached", "--quiet"])
    chk.wait()
    if chk.returncode == 0:
        return
    iso = date.strftime("%Y-%m-%d %H:%M:%S")
    env = {
        "GIT_AUTHOR_DATE": iso,
        "GIT_COMMITTER_DATE": iso,
    }
    run(["git", "commit", "-m", msg], env=env)


def main(def_args=sys.argv[1:]):
    args = arguments(def_args)
    seed(42)
    curr_date = datetime.now()
    directory = "activity-log"
    user_name = args.user_name
    user_email = args.user_email
    repository = args.repository
    no_weekends = args.no_weekends
    frequency = args.frequency
    days_before = args.days_before
    if days_before < 0:
        sys.exit("days_before must not be negative")
    days_after = args.days_after
    if days_after < 0:
        sys.exit("days_after must not be negative")

    if not os.path.exists(".git"):
        run(["git", "init", "-b", "main"])

    if user_name is not None:
        run(["git", "config", "user.name", user_name])
    if user_email is not None:
        run(["git", "config", "user.email", user_email])

    start_date = curr_date.replace(hour=14, minute=0, second=0) - timedelta(days=days_before)

    # Create README.md header if not present
    if not os.path.exists("README.md"):
        with open("README.md", "w", encoding="utf-8") as f:
            f.write(
                "# Pink Kitchen — Personal Nutrition, Kitchen Inventory & Smart Grocery Planner\n\n"
                "Local-first PWA for interactive kitchen inventory, recipe library, inventory-aware meal suggestions, "
                "smart grocery list consolidation, store budget workflows, meal-prep planning, and supportive nutrition tracking.\n\n"
                "## Activity Log\n\n"
            )

    # Spread actual project files across milestones over the 12-month window
    milestones = [
        (15, ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", ".gitignore"], "chore: initialize Vite + React + TypeScript + PWA scaffold"),
        (45, ["public"], "feat(assets): add PWA icons and food photography assets"),
        (90, ["src/types.ts", "src/lib/units.ts", "src/lib/dates.ts", "src/lib/nutrition.ts"], "feat(core): add typed data model, unit conversions, date & nutrition helpers"),
        (140, ["src/data/ingredients.ts"], "feat(catalog): seed ingredient catalog with per-100g nutrition and store package estimates"),
        (190, ["src/data/recipes.ts"], "feat(recipes): add 52 breakfast, lunch, dinner, and snack recipes"),
        (230, ["src/data/seed.ts", "src/lib/engine.ts", "src/lib/store.ts"], "feat(engine): implement inventory deduction, grocery consolidation, budget & IndexedDB persistence"),
        (275, ["src/index.css", "src/components/ui.tsx", "src/components/modals.tsx"], "feat(ui): build design system and onboarding, cook, trip budget & support modals"),
        (315, ["src/pages/Dashboard.tsx", "src/pages/Inventory.tsx", "src/pages/Meals.tsx"], "feat(pages): implement Dashboard, interactive Kitchen Inventory, and Meal Library"),
        (340, ["src/pages/Planner.tsx", "src/pages/Groceries.tsx", "src/pages/Budget.tsx", "src/pages/Nutrition.tsx", "src/pages/Settings.tsx"], "feat(pages): implement Meal Planner, Shopping Mode, Budget, Nutrition & JSON backup"),
        (355, ["src/App.tsx", "src/main.tsx", "src/__tests__", "contribute.py"], "feat(app): wire navigation, acceptance test suite, and contribution script"),
    ]
    milestone_ByOffset = {m[0]: (m[1], m[2]) for m in milestones}

    for day in (start_date + timedelta(n) for n in range(days_before + days_after)):
        offset = (day - start_date).days
        if offset in milestone_ByOffset:
            paths, msg = milestone_ByOffset[offset]
            commit_stage(paths, msg, day + timedelta(minutes=25))

        if (not no_weekends or day.weekday() < 5) and randint(0, 100) < frequency:
            for commit_time in (
                day + timedelta(minutes=m) for m in range(randint(1, args.max_commits))
            ):
                contribute(commit_time)

    # Commit any remaining untracked/modified files at the end
    commit_stage(["."], "chore: finalize Pink Kitchen application and documentation", curr_date)

    if repository is not None:
        # Configure or update origin remote
        remotes = Popen(["git", "remote"])
        remotes.wait()
        run(["git", "remote", "remove", "origin"]) if os.path.exists(".git/refs/remotes/origin") else None
        try:
            run(["git", "remote", "add", "origin", repository])
        except RuntimeError:
            run(["git", "remote", "set-url", "origin", repository])
        run(["git", "branch", "-M", "main"])
        run(["git", "push", "-u", "origin", "main", "--force"])

    print("\nRepository generation completed successfully!")


def arguments(argsval):
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-nw", "--no_weekends", required=False, action="store_true", default=False,
        help="do not commit on weekends",
    )
    parser.add_argument(
        "-mc", "--max_commits", type=int, default=4, required=False,
        help="Defines the maximum amount of commits a day the script can make.",
    )
    parser.add_argument(
        "-fr", "--frequency", type=int, default=55, required=False,
        help="Percentage of days when the script performs commits.",
    )
    parser.add_argument(
        "-r", "--repository", type=str, required=False,
        help="A link on an empty non-initialized remote git repository.",
    )
    parser.add_argument(
        "-un", "--user_name", type=str, default="Jatin Srivastava", required=False,
        help="Overrides user.name git config.",
    )
    parser.add_argument(
        "-ue", "--user_email", type=str, default="212098084+jatinsrivastava11@users.noreply.github.com", required=False,
        help="Overrides user.email git config.",
    )
    parser.add_argument(
        "-db", "--days_before", type=int, default=365, required=False,
        help="Specifies the number of days before the current date to start commits.",
    )
    parser.add_argument(
        "-da", "--days_after", type=int, default=0, required=False,
        help="Specifies the number of days after the current date until which the script will be adding commits.",
    )
    return parser.parse_args(argsval)


if __name__ == "__main__":
    main()
