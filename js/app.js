import {
	delegate,
	getAppLocation,
	setAppLocation,
	insertHTML,
	replaceHTML,
	setWindowURLFragment
} from "./helpers.js";
import {TodoStore} from "./store.js";
import {uuid} from 'https://edge.js.m-ld.org/ext/index.mjs';

const App = {
	$: {
		input: document.querySelector('[data-todo="new"]'),
		progress: document.querySelector('[data-todo="progress"]'),
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
				const {filter} = getAppLocation(el.getAttribute('href'));
				el.setAttribute('href', `#/${App.todos.id}/${filter}`);
			});
		},
		setActiveFilter(filter) {
			App.$.filters.forEach((el) => {
				if (el.matches(`[href="#/${App.todos.id}/${filter}"]`)) {
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
			return $li && {
				$li,
				get $input() {
					return $li.querySelector('[data-todo="edit"]')
				},
				get $label() {
					return $li.querySelector('[data-todo="label"]')
				}
			};
		},
		getEditing() {
			const $li = document.querySelector('.editing');
			if ($li != null) {
				const editingId = $li.dataset.id;
				const $input = App.$.getTodo($li).$input;
				const selection = [$input.selectionStart, $input.selectionEnd];
				return {
					id: editingId,
					restore() { return App.$.setEditing(editingId, ...selection); }
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
	async login() {
		// Login removes the document fragment, so keep it in storage
		// See https://www.rfc-editor.org/rfc/rfc6749#section-3.1.2
		if (getAppLocation() != null) {
			sessionStorage.setItem("docLocation", document.location.hash);
			setWindowURLFragment(null);
		}
		const keycloak = new Keycloak({
			url: "https://app.please-open.it",
			realm: "5d970145-a48d-4e9b-84ab-15de19f9d3a5",
			clientId: "app-local"
		});
		await keycloak.init({
			onLoad: "login-required",
			flow: "implicit",
			checkLoginIframe: false
		});
		let docLocation = sessionStorage.getItem("docLocation");
		if (docLocation != null) {
			sessionStorage.removeItem("docLocation");
			setWindowURLFragment(docLocation);
		}
		return keycloak.token;
	},
	async init() {
		function onHashChange() {
			let {documentId, filter} = getAppLocation() ?? {};
			if (!documentId) {
				documentId = (documentId ?? localStorage.getItem("lastTodoList")) || uuid();
				setAppLocation(documentId, filter);
			}
			localStorage.setItem("lastTodoList", documentId);
			App.filter = filter;
			if (App.todos == null || App.todos.id !== documentId) {
				App.todos?.close();
				App.todos = new TodoStore(documentId, token);
				App.$.updateFilterHashes();
				App.todos.addEventListener("save", App.render);
				App.todos.addEventListener("error", App.error);
			} else {
				App.$.setActiveFilter(App.filter);
				App.render();
			}
		}

		let token = await App.login();
		window.addEventListener("hashchange", onHashChange);
		onHashChange();
		App.$.input.addEventListener("keyup", (e) => {
			if (e.key === "Enter" && e.target.value.length) {
				App.todos.add({title: e.target.value});
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
			let $input = App.$.getTodo($li).$input;
			if (e.key === "Enter" && $input.value) {
				$li.classList.remove("editing");
				App.todos.update({ ...todo, title: $input.value });
			}
			if (e.key === "Escape") {
				document.activeElement.blur();
			}
		});
		App.todoEvent("focusout", '[data-todo="edit"]', (todo, $li) => {
			if ($li.classList.contains("editing")) {
				App.render();
			}
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
		App.$.progress.hidden = true;
		editing?.restore(); // TODO: What if no longer present (filtered out or removed)
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

App.init().catch(error => App.error(new ErrorEvent('error', {error})));
