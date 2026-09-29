# @stackline/unified-diff

> Filter unified diagnostics to changed Git lines while preserving the unified-diff plugin API.

[![npm version](https://img.shields.io/npm/v/@stackline/unified-diff.svg?style=flat-square)](https://www.npmjs.com/package/@stackline/unified-diff)
[![license](https://img.shields.io/npm/l/@stackline/unified-diff.svg?style=flat-square)](https://github.com/alexandroit/stackline-unified-diff)
[![GitHub repository](https://img.shields.io/badge/GitHub-repository-181717?style=flat-square&logo=github)](https://github.com/alexandroit/stackline-unified-diff)
[![Docs](https://img.shields.io/badge/docs-alexandro.net-0f766e?style=flat-square)](https://alexandro.net/docs/vanilla/unified-diff/)
[![Reddit community](https://img.shields.io/badge/community-r%2FStackline-ff4500?style=flat-square&logo=reddit&logoColor=white)](https://www.reddit.com/r/Stackline/)

**[Documentation](https://alexandro.net/docs/vanilla/unified-diff/)** | **[npm](https://www.npmjs.com/package/@stackline/unified-diff)** | **[Issues](https://github.com/alexandroit/stackline-unified-diff/issues)** | **[Repository](https://github.com/alexandroit/stackline-unified-diff)**

**Current package version:** `1.0.5`

---

## Why this package?

A scoped maintenance fork of `unified-diff@4.0.1` by Titus Wormer (MIT). The unified plugin and API are retained, with `@stackline/git-diff-tree@1.0.0` replacing deprecated transitive stream dependencies. Binary and mode-only patches no longer throw when no text hunk is present. Version 1.0.1 also fixes inherited changed-line accounting for replacements and multiple Git hunks. Requires Node.js 18 or newer and Git on PATH.

Install with `npm install @stackline/unified-diff`; import with `import unifiedDiff from "@stackline/unified-diff"`. `UPSTREAM.json` identifies the released source and integrity. `npm test` runs the original Travis/GitHub Actions scenarios and focused regressions. `npm run build` and `npm run lint` check JavaScript syntax; `npm run test:package` tests a fresh packed consumer install.

[**unified**][unified] plugin to ignore unrelated messages.
Currently works in PRs on Travis and GitHub Actions.

When working with natural language, having tools that check cumbersome tasks
can be very useful (think [alex][] or [retext][] plugins).
However, natural language isn’t as strict as code.
Integrating natural language checking in a CI often doesn’t work well due to
false positives.
It’s possible to add a long list of exceptions, but this soon becomes
unmanageable.

This plugin solves that problem, when in CIs, by ignoring any messages on
unchanged lines.
When run outside supported CIs this plugin doesn’t do anything.

## Compatibility

| Item | Value |
| --- | --- |
| Package | `@stackline/unified-diff@1.0.5` |
| Supported Node.js | `>=18` |
| Module entry | `index.js` (ES modules) |
| Runtime dependencies | 2 direct dependencies |
| Types | `index.d.ts` |
| External tool | Git available on `PATH` |

## Installation

```bash
npm install @stackline/unified-diff
```

<a id="install"></a>

This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c):
Node 12+ is needed to use it and it must be `import`ed instead of `require`d.

[npm][]:

```sh
npm install @stackline/unified-diff
```

## Usage

<a id="use"></a>

Say we have this `readme.md`.
Note the `an an`.

```markdown
This is an an example.
```

Then, someone creates a PR which adds the following diff:

```diff
diff --git a/readme.md b/readme.md
index 360b225..5a96b86 100644
--- a/readme.md
+++ b/readme.md
@@ -1 +1,3 @@
 This is an an example.
+
+Some more more text. A error.
```

We have some natural language checking in `lint.js`:

```js
import {toVFile} from 'to-vfile'
import {reporter} from 'vfile-reporter'
import {unified} from 'unified'
import unifiedDiff from '@stackline/unified-diff'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkRetext from 'remark-retext'
import retextEnglish from 'retext-english'
import retextRepeatedWords from 'retext-repeated-words'
import retextIndefiniteArticle from 'retext-indefinite-article'

toVFile.read('readme.md').then((file) => {
  unified()
    .use(remarkParse)
    .use(
      remarkRetext,
      unified()
        .use(retextEnglish)
        .use(retextRepeatedWords)
        .use(retextIndefiniteArticle)
    )
    .use(remarkStringify)
    .use(unifiedDiff)
    .process(file)
    .then((file) => {
      console.error(reporter(file))
      process.exit(file.messages.length > 0 ? 1 : 0)
    })
})
```

`lint.js` is hooked up to run on Travis in `.travis.yml` like so:

```yml
# ...
script:
- npm test
- node lint.js
# ...
```

(or in an equivalent GH Actions workflow file)

When run in CI, we’ll see the following printed on **stderr**(4).
Note that `an an` on L1 is not included because it’s unrelated to this PR.

```txt
readme.md
   3:6-3:15  warning  Expected `more` once, not twice   retext-repeated-words      retext-repeated-words
  3:22-3:23  warning  Use `An` before `error`, not `A`  retext-indefinite-article  retext-indefinite-article

⚠ 2 warnings
```

As there are messages, the build exits with `1`, thus failing CI.
The user sees this and amends the PR to the following:

```diff
diff --git a/readme.md b/readme.md
index 360b225..5a96b86 100644
--- a/readme.md
+++ b/readme.md
@@ -1 +1,3 @@
 This is an an example.
+
+Some more text. An error.
```

This time our lint task exits successfully, even though L1 would normally emit
an error, but it’s unrelated to the PR.

## Security

Filtering diagnostics does not validate the content of a change. The plugin preserves added-line accounting across multiple hunks and skips binary or mode-only changes without text hunks.

## API Surface

<a id="api"></a>

This package exports a plugin as the default export.

### `unified().use(diff)`

Ignore messages emitted by plugins before `diff` for lines that did not change.

There are no options.
If there’s a `TRAVIS_COMMIT_RANGE`, `GITHUB_BASE_REF` and `GITHUB_HEAD_REF`, or
`GITHUB_SHA` environment variable, then this plugin runs, otherwise it does
nothing.

###### To do

*   [ ] Add support for other CIs (ping if you want to work on this)
*   [ ] Add non-CI support (I’m not yet sure how though)

PRs welcome!

## Local Development

Clone the [repository](https://github.com/alexandroit/stackline-unified-diff) and run the following commands from its root:

```bash
npm ci
npm run build
npm test
npm run lint
```

The retained upstream development notes below include historical tooling; the commands above are the maintained package checks.

### Contribute

See [`contributing.md`][contributing] in [`unifiedjs/.github`][health] for ways
to get started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## Consumer Smoke Test

`npm run test:package` packs the library and exercises an isolated consumer using the repository fixture.

## Release Checklist

1. Update the package version, lockfile, generated version fields, and changelog together.
2. Run the development checks above and audit both `npm audit` and `npm audit --omit=dev`.
3. Use the [GitHub publish workflow](https://github.com/alexandroit/stackline-unified-diff/actions/workflows/publish.yml) with its `Prod` environment to publish the exact CI tarball.
4. Verify public npm bytes, package identity, provenance, and the immutable GitHub release evidence.

## License

[MIT](https://github.com/alexandroit/stackline-unified-diff/blob/main/license). Original copyright notices and upstream attribution are retained.

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/unifiedjs/unified-diff/workflows/main/badge.svg

[build]: https://github.com/unifiedjs/unified-diff/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/unifiedjs/unified-diff.svg

[coverage]: https://codecov.io/github/unifiedjs/unified-diff

[downloads-badge]: https://img.shields.io/npm/dm/unified-diff.svg

[downloads]: https://www.npmjs.com/package/unified-diff

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/unifiedjs/unified/discussions

[npm]: https://docs.npmjs.com/cli/install

[health]: https://github.com/unifiedjs/.github

[contributing]: https://github.com/unifiedjs/.github/blob/HEAD/contributing.md

[support]: https://github.com/unifiedjs/.github/blob/HEAD/support.md

[coc]: https://github.com/unifiedjs/.github/blob/HEAD/code-of-conduct.md

[license]: license

[author]: https://wooorm.com

[unified]: https://github.com/unifiedjs/unified

[alex]: https://github.com/wooorm/alex

[retext]: https://github.com/retextjs/retext/blob/HEAD/doc/plugins.md#list-of-plugins

See [NOTICE](https://github.com/alexandroit/stackline-unified-diff/blob/main/NOTICE) for retained attribution.

## Credits and original authors

- Original project: [unified-diff](https://github.com/unifiedjs/unified-diff).
- Titus Wormer.
- Copyright (c) 2016 Titus Wormer <tituswormer@gmail.com>.
- Stackline maintenance: [Alexandro Paixao Marques](https://www.linkedin.com/in/aleinfo/) and [Stackline contributors](https://github.com/alexandroit).

Original copyright, license notices and contributor acknowledgements remain part of this distribution. Stackline maintenance does not replace authorship of the original work.

## Community and Links

- [Stackline website](https://alexandro.net/)
- [GitHub projects](https://github.com/alexandroit)
- [npm packages](https://www.npmjs.com/~alex360qc)
- [Reddit community — r/Stackline](https://www.reddit.com/r/Stackline/)
- [Maintainer LinkedIn](https://www.linkedin.com/in/aleinfo/)

Use this repository's issue tracker for reproducible bugs and feature requests. Join r/Stackline for examples, usage questions and release discussions.
