# Prompt IDE

**Assemble. Test. Share.**

Prompt IDE is a lightweight open‑source editor for LLM experiments. It turns long prompts into manageable blocks so you can iterate faster and move results between projects with ease.

## Features
- Modular messages with roles (`system`, `user`, `assistant`, `comment`)
- Quick runs against any OpenAI model using your own API key
- Responses stored directly inside the prompt
- Reordering, disabling, hiding, and edit/preview modes
- Tool definitions for function calling
- Autosave and offline‑friendly local storage
- Share‑only links for read‑only viewing
- Import/export for single prompts or the entire workspace
- Light and dark themes

## Technologies
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Ant Design](https://ant.design/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Day.js](https://day.js.org/) and [lz-string](https://pieroxy.net/blog/pages/lz-string/index.html) for data handling
- [React Markdown](https://github.com/remarkjs/react-markdown) with `remark-gfm` and `rehype-sanitize`

## Getting Started
```bash
npm install
npm run dev
```
The development server starts on [http://localhost:5173](http://localhost:5173). Enter your OpenAI API key in the sidebar to run prompts against the model of your choice.

## Usage
1. Create a prompt from short messages and assign roles.
2. Drag to reorder, disable, or hide blocks.
3. Run the prompt; responses are stored alongside the messages.
4. Share a read‑only link or export the workspace for versioning.

## Pull Request Flow
1. Fork the repository and create a feature branch.
2. ~~Install dependencies and run `npm run lint`~~ (now it looks bad).
3. Commit your changes with clear messages.
4. Open a pull request against `main` and describe your change.
5. Wait for review and address any feedback.

## Roadmap
1. Rewrite vibe-code into proper code
2. Add test coverage
3. Add prompt folders
4. Coming soon

## License
This project is licensed under the [MIT License](./LICENSE).
