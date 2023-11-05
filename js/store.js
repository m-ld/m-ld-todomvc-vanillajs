import {uuid, clone, isReference, updateSubject} from 'https://edge.js.m-ld.org/ext/index.mjs';
import {MemoryLevel} from 'https://edge.js.m-ld.org/ext/memory-level.mjs';
import {IoRemotes} from 'https://edge.js.m-ld.org/ext/socket.io.mjs';

/**
 * @typedef {object} Todo
 * @property {string} id
 * @property {string} title
 * @property {boolean} completed
 */

/** Store API for current Todos */
export class TodoStore extends EventTarget {
	constructor(todosId, token) {
		super();
		this.id = todosId;
		this._readStorage(token);
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
	}
	_handleError = (error) => {
		this.dispatchEvent(new ErrorEvent('error', {error}));
	};
	_readStorage(token) {
		this.todos = [];
		// This loads any new to-do details from plain references
		// TODO: This will improve with the use of a reactive observable query
		function loadTodoReferences(todos, state) {
			return Promise.all(todos.map(async (todo, i) => {
				if (isReference(todo))
					todos[i] = await state.get(todo['@id']);
			}));
		}
		// Exchange the access token for gateway domain configuration
		fetch(`/api/config?domain=${this.id}`, {
			headers: { 'Authorization': `Bearer ${token}` }
		}).then(async configRes => {
			const config = await configRes.json();
			const meld = await clone(new MemoryLevel, IoRemotes, {'@id': uuid(), ...config});
			this.meld = meld;
			await meld.status.becomes({ outdated: false });
			meld.read(async state => {
				this.todos = (await state.get('todos'))?.['@list'] ?? [];
				await loadTodoReferences(this.todos, state);
				this.dispatchEvent(new CustomEvent("save"));
			}, async (update, state) => {
				updateSubject({'@id': 'todos', '@list': this.todos}, update);
				await loadTodoReferences(this.todos, state);
				this.dispatchEvent(new CustomEvent("save"));
			});
		}).catch(this._handleError);
	}
	_save(write) {
		this.meld.write(write).catch(this._handleError);
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
		this._save({
			'@update': {'@id': id, title}
		});
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
