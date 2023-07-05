import {delegate, getURLHash, insertHTML, replaceHTML} from "./helpers.js";
import {TodoStore} from "./store.js";
import {uuid} from 'https://edge.js.m-ld.org/ext/index.mjs';

const App = {
	$: {
		input: document.querySelector('[data-todo="new"]'),
		toggleAll: document.querySelector('[data-todo="toggle-all"]'),
		clear: document.querySelector('[data-todo="clear-completed"]'),
		list: document.querySelector('[data-todo="list"]'),
		filters: document.querySelectorAll(`[data-todo="filters"] a`),
		showMain(show) {
			document.querySelector('[data-todo="main"]').style.display = show ? "block" : "none";
		},
		showFooter(show) {
			document.querySelector('[data-todo="footer"]').style.display = show ? "block" : "none";
		},
		showClear(show) {
			App.$.clear.style.display = show ? "block" : "none";
		},
		updateFilterHashes() {
			App.$.filters.forEach((el) => {
				const {filter} = getURLHash(el.getAttribute('href'));
				el.setAttribute('href', `#/${App.todos.id}/${filter}`);
			});
		},
		setActiveFilter(filter) {
			App.$.filters.forEach((el) => {
				if (el.matches(`[href="#/${filter}"]`)) {
					el.classList.add("selected");
				} else {
					el.classList.remove("selected");
				}
			});
		},
		displayCount(count) {
			replaceHTML(
				document.querySelector('[data-todo="count"]'),
				`
				<strong>${count}</strong>
				${count === 1 ? "item" : "items"} left
			`
			);
		},
		getTodo(liOrId) {
			let $li = liOrId instanceof Element ? liOrId :
				document.querySelector(`[data-id="${liOrId}"]`);
			if ($li != null) {
				return {
					$li,
					get $input() {
						return $li.querySelector('[data-todo="edit"]')
					},
					get $label() {
						return $li.querySelector('[data-todo="label"]')
					}
				}
			}
		},
		getEditing() {
			const $li = document.querySelector('.editing');
			if ($li != null) {
				const editingId = $li.dataset.id;
				const $input = App.$.getTodo($li).$input;
				const selection = {
					start: $input.selectionStart, end: $input.selectionEnd
				};
				return {
					id: editingId,
					restore(saveEvent) {
						if (!saveEvent.detail.isEcho) {
							// Check whether the active to-do has been spliced
							for (let matchingExpr of [].concat(
								saveEvent.detail.update['@update']
									.find(todo => todo['@id'] === editingId)?.title
							)) {
								// If so, we need to adjust the caret and
								// selection based on the updates made
								const [index, deleteCount, content] = matchingExpr?.['@splice'] ?? [];
								if (index < selection.start) {
									selection.start += content.length - deleteCount;
								}
								if (index < selection.end) {
									selection.end += content.length - deleteCount;
								}
							}
						}
						return App.$.setEditing(editingId, selection.start, selection.end);
					}
				}
			}
		},
		setEditing(liOrId, selectionStart, selectionEnd) {
			let $todo = App.$.getTodo(liOrId);
			if ($todo != null) {
				$todo.$li.classList.add("editing");
				$todo.$input.focus();
				$todo.$input.setSelectionRange(selectionStart, selectionEnd);
				return $todo;
			}
		}
	},
	init() {
		function onHashChange() {
			let {todosId, filter} = getURLHash(document.location.hash);
			const isNew = !todosId;
			if (isNew) {
				todosId = uuid();
				history.pushState(null, null, `#/${todosId}/${filter}`);
			}
			if (App.todos == null || App.todos.id !== todosId) {
				App.todos?.close();
				App.todos = new TodoStore(todosId, isNew);
				App.$.updateFilterHashes();
				App.todos.addEventListener("save", App.render);
				App.todos.addEventListener("error", App.error);
			}
			App.filter = filter;
		}
		window.addEventListener("hashchange", onHashChange);
		onHashChange();
		App.$.input.addEventListener("keyup", (e) => {
			if (e.key === "Enter" && e.target.value.length) {
				App.todos.add({ title: e.target.value });
				App.$.input.value = "";
			}
		});
		App.$.toggleAll.addEventListener("click", () => {
			App.todos.toggleAll();
		});
		App.$.clear.addEventListener("click", () => {
			App.todos.clearCompleted();
		});
		App.bindTodoEvents();
	},
	todoEvent(event, selector, handler) {
		delegate(App.$.list, selector, event, (e) => {
			let $el = e.target.closest("[data-id]");
			handler(App.todos.get($el.dataset.id), $el, e);
		});
	},
	bindTodoEvents() {
		App.todoEvent("click", '[data-todo="destroy"]', (todo) => App.todos.remove(todo));
		App.todoEvent("click", '[data-todo="toggle"]', (todo) => App.todos.toggle(todo));
		App.todoEvent("dblclick", '[data-todo="label"]', (_, $li) => {
			App.$.setEditing($li);
		});
		App.todoEvent("keyup", '[data-todo="edit"]', (todo, $li, e) => {
			if (e.key === "Enter" || e.key === "Escape") {
				$li.classList.remove("editing");
			}
		});
		App.todoEvent("input", '[data-todo="edit"]', (todo, $li) => {
			let $input = App.$.getTodo($li).$input;
			App.todos.update({ ...todo, title: $input.value });
		});
		// Comment out this block to test multiple clones on the same machine
		App.todoEvent("focusout", '[data-todo="edit"]', (todo, $li) => {
			$li.classList.remove("editing");
		});
	},
	createTodoItem(todo) {
		const li = document.createElement("li");
		li.dataset.id = todo['@id'];
		if (todo.completed) {
			li.classList.add("completed");
		}
		insertHTML(
			li,
			`
			<div class="view">
				<input data-todo="toggle" class="toggle" type="checkbox" ${todo.completed ? "checked" : ""}>
				<label data-todo="label"></label>
				<button class="destroy" data-todo="destroy"></button>
			</div>
			<input class="edit" data-todo="edit">
		`
		);
		App.$.getTodo(li).$label.textContent = todo.title;
		App.$.getTodo(li).$input.value = todo.title;
		return li;
	},
	render(saveEvent) {
		const editing = saveEvent && App.$.getEditing();
		const count = App.todos.all().length;
		App.$.setActiveFilter(App.filter);
		App.$.list.replaceChildren(...App.todos.all(App.filter).map((todo) => App.createTodoItem(todo)));
		App.$.showMain(count);
		App.$.showFooter(count);
		App.$.showClear(App.todos.hasCompleted());
		App.$.toggleAll.checked = App.todos.isAllCompleted();
		App.$.displayCount(App.todos.all("active").length);
		App.$.input.disabled = false;
		editing?.restore(saveEvent); // TODO: What if no longer present (filtered out or removed)
	},
	error(errEvent) {
		replaceHTML(document.querySelector('.todoapp'), `
		<header class="header">
			<h1><a href=".">todos</a></h1>
			<p>${errEvent.error}</p>
		</header>
		`);
	}
};

App.init();
