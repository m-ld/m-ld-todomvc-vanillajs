import {clone, isReference, updateSubject, uuid, textDiff} from 'https://edge.js.m-ld.org/ext/index.mjs';
import {MemoryLevel} from 'https://edge.js.m-ld.org/ext/memory-level.mjs';
import {IoRemotes} from 'https://edge.js.m-ld.org/ext/socket.io.mjs';
import {TSeqText} from 'https://edge.js.m-ld.org/ext/tseq.mjs';

/**
 * @typedef {object} Todo
 * @property {string} id
 * @property {string} title
 * @property {boolean} completed
 */

/** Store API for current Todos */
export class TodoStore extends EventTarget {
	constructor(todosId, isNew) {
		super();
		this.id = todosId;
		this._readStorage(isNew);
		// GETTER methods
		this.get = (id) => this.todos.find((todo) => todo['@id'] === id);
		this.isAllCompleted = () => this.todos.every((todo) => todo.completed);
		this.hasCompleted = () => this.todos.some((todo) => todo.completed);
		this.all = (filter) =>
			filter === "active"
				? this.todos.filter((todo) => !todo.completed)
				: filter === "completed"
				? this.todos.filter((todo) => todo.completed)
				: this.todos;
		this._updating = false;
	}
	_handleError = (error) => {
		this.dispatchEvent(new ErrorEvent('error', {error}));
	};
	_readStorage(isNew) {
		this.todos = [];
		// This loads any new to-do details from plain references
		// TODO: This will improve with the use of a reactive observable query
		function loadTodoReferences(todos, state, update) {
			return Promise.all(todos.map(async (todo, i) => {
				if (isReference(todo))
					todos[i] = await state.get(todo['@id']);
			}));
		}
		clone(new MemoryLevel, IoRemotes, {
			'@id': uuid(),
			'@domain': `${this.id}.todomvc.m-ld.org`,
			genesis: isNew,
			io: {uri: `http://${window.location.hostname}:3001`},
		}, new TSeqText('title')).then(async meld => {
			this.meld = meld;
			await meld.status.becomes({ outdated: false });
			meld.read(async state => {
				this.todos = (await state.get('todos'))?.['@list'] ?? [];
				await loadTodoReferences(this.todos, state);
				this.dispatchEvent(new CustomEvent("save", {
					// We include the actual update made as a detail of the save
					// event so that the app can adjust the caret and selection
					detail: {update, isEcho: this._updating}
				}));
			}, async (update, state) => {
				updateSubject({'@id': 'todos', '@list': this.todos}, update);
				await loadTodoReferences(this.todos, state, update);
				this.dispatchEvent(new CustomEvent("save", {
					// We include the actual update made as a detail of the save
					// event so that the app can adjust the caret and selection
					detail: {update, isEcho: this._updating}
				}));
			});
		}).catch(this._handleError);
	}
	_save(write) {
		this.meld.write(async (state) => {
			// This allows us to tell the app whether an update is an echo
			this._updating = true;
			try {
				await state.write(write);
			} finally {
				this._updating = false;
			}
		}).catch(this._handleError);
	}
	// MUTATE methods
	add({ title }) {
		this._save({
			'@id': 'todos',
			'@list': {
				[this.todos.length]: {
					title,
					completed: false,
					'@id': "id_" + Date.now(),
				}
			}
		});
	}
	remove({ '@id': id }) {
		this._save({
			'@delete': {
				'@id': 'todos',
				'@list': {'?': {'@id': id, '?': '?'}}
			}
		});
	}
	toggle({ '@id': id, completed }) {
		this._save({
			'@update': {'@id': id, completed: !completed}
		});
	}
	clearCompleted() {
		this.todos = this.todos.filter((todo) => !todo.completed);
		this._save({
			'@delete': {
				'@id': 'todos',
				'@list': {'?': {completed: true, '?': '?'}}
			}
		});
	}
	update({ '@id': id, title }) {
		// The textDiff utility generates splices from a whole-text comparison
		for (let splice of textDiff(this.get(id).title, title)) {
			this._save({
				'@update': {'@id': id, title: {'@splice': splice}}
			});
		}
	}
	toggleAll() {
		const completed = !this.hasCompleted() || !this.isAllCompleted();
		this._save({
			// TODO: This ought to be possible with @update
			'@delete': {'@id': '?id', completed: !completed},
			'@insert': {'@id': '?id', completed},
			'@where': {'@id': '?id', completed: !completed}
		});
	}
	close() {
		this.meld?.close().catch(console.error);
	}
}
