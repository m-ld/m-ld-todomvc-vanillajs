import {getAppLocation, matches, processHash, replaceHTML} from "./helpers.js";
import {initModel} from "./model.js";
import {watchQuery, watchSubject} from "@m-ld/m-ld/ext/rx";

class Todo {
	/**@type HTMLLIElement*/li;
	/**@type HTMLInputElement*/edit;
	/**@type {{unsubscribe: () => void}}*/subs;

	constructor({"@id": id}, app) {
		this.id = id;
		const fragment = document.getElementById("todo-template")
			.content.cloneNode(true);
		this.li = fragment.getElementById("todo");
		this.li.dataset.id = id;
		const destroy = fragment.getElementById("destroy");
		destroy.addEventListener("click", () => {
			app.model.write({
				'@delete': {
					'@id': 'todos',
					'@list': {'?': {'@id': id, '?': '?'}}
				}
			}).catch(app.error);
		});
		const toggle = fragment.getElementById("toggle");
		toggle.addEventListener("click", () => {
			app.model.write({
				'@update': {'@id': id, completed: toggle.checked}
			}).catch(app.error);
		});
		const label = fragment.getElementById("label");
		label.addEventListener("dblclick", () => {
			this.setEditSelection();
		});
		this.edit = fragment.getElementById("edit");
		this.edit.addEventListener("keyup", e => {
			if (e.key === "Enter" && this.edit.value) {
				this.li.classList.remove("editing");
				app.model.write({
					'@update': {'@id': id, title: this.edit.value}
				}).catch(app.error);
			}
			if (e.key === "Escape")
				this.edit.blur();
		});
		this.edit.addEventListener("focusout", () => {
			if (this.li.classList.contains("editing"))
				app.refresh();
		});
		this.subs = watchSubject(app.model, id).subscribe(todo => {
			this.li.classList[todo.completed ? "add" : "remove"]("completed");
			toggle.checked = todo.completed;
			label.textContent = todo.title;
			this.edit.value = todo.title;
		});
	}

	get isEditing() {
		return this.li.classList.contains("editing");
	}

	getEditSelection() {
		return [this.edit.selectionStart, this.edit.selectionEnd];
	}

	setEditSelection(selectionStart, selectionEnd) {
		this.li.classList.add("editing");
		this.edit.focus();
		if (arguments.length)
			this.edit.setSelectionRange(selectionStart, selectionEnd);
	}

	remove() {
		this.li.remove();
		this.subs.unsubscribe();
	}
}

export default new class App {
	/**@type string*/filter;
	/**@type string*/modelId;
	/**@type {import('@m-ld/m-ld').MeldClone}*/model;
	/**@type {{'@id': string, completed: boolean}[]}*/summary;
	/**@type Todo[]*/todos = [];

	constructor() {
		window.addEventListener("hashchange", this.onHashChange);
		this.onHashChange();
		document.getElementById("new").addEventListener("keyup", (e) => {
			if (e.key === "Enter" && e.target.value.length) {
				this.model.write({
					'@id': 'todos',
					'@list': {
						[this.summary.length]: {
							title: e.target.value,
							completed: false,
							'@id': "id_" + Date.now(),
						}
					}
				}).catch(this.error);
				document.getElementById("new").value = "";
			}
		});
		document.getElementById("toggle-all").addEventListener("click", () => {
			const anyActive = this.summary.some(({completed}) => !completed);
			this.model.write({
				"@delete": {"@id": "?id", completed: !anyActive},
				"@insert": {"@id": "?id", completed: anyActive}
			}).catch(this.error);
		});
		document.getElementById("clear-completed").addEventListener("click", () => {
			this.model.write({
				"@delete": {
					"@id": "todos",
					"@list": {"?": {completed: true, "?": "?"}}
				}
			}).catch(this.error);
		});
	}

	onHashChange = () => {
		const {modelId, isNew, filter} = processHash();
		this.filter = filter;
		if (this.model == null || this.modelId !== modelId) {
			this.model?.close().catch(console.error);
			initModel(modelId, isNew).then(model => {
				this.model = model;
				this.modelId = modelId;
				document.getElementById("filters").querySelectorAll('a').forEach((el) => {
					const {filter} = getAppLocation(el.getAttribute('href'));
					el.setAttribute('href', `#/${this.modelId}/${filter}`);
				});
				watchQuery(model, async state =>
					await state.read({
						"@construct": {
							"@id": "todos",
							"@list": {"?i": {"@id": "?", "completed": "?c"}}
						}
					})
				).subscribe(([items]) => {
					this.summary = items?.["@list"] ?? [];
					this.refresh();
				});
			}).catch(this.error);
		} else {
			this.setActiveFilter(this.filter);
			this.refresh();
		}
	};

	setActiveFilter(filter) {
		document.getElementById("filters").querySelectorAll('a').forEach(el => {
			const selected = el.matches(`[href="#/${this.modelId}/${filter}"]`);
			el.classList[selected ? "add" : "remove"]("selected");
		});
	}

	refresh() {
		const editing = this.todos.find(todo => todo.isEditing),
			editSelection = editing && editing.getEditSelection(),
			anyCompleted = this.summary.some(({completed}) => completed),
			allCompleted = this.summary.every(({completed}) => completed),
			active = this.summary.filter(({completed}) => !completed);
		this.setActiveFilter(this.filter);
		this.todos.forEach(todo => todo.remove());
		this.todos = this.summary
			.filter(item => matches(item, this.filter))
			.map(item => new Todo(item, this));
		document.getElementById("list").replaceChildren(
			document.getElementById("todo-template"),
			...this.todos.map(todo => todo.li)
		);
		document.getElementById("main").style.display = this.summary.length ? "block" : "none";
		document.getElementById("footer").style.display = this.summary.length ? "block" : "none";
		document.getElementById("clear-completed").style.display = anyCompleted ? "block" : "none";
		document.getElementById("toggle-all").checked = allCompleted;
		replaceHTML(document.getElementById("count"), `
			<strong>${(active.length)}</strong>
			${active.length === 1 ? "item" : "items"} left
		`);
		document.getElementById("new").disabled = false;
		document.getElementById("progress").hidden = true;
		(editing && this.todos.find(todo => todo.id === editing.id))
			?.setEditSelection(...editSelection);
	}

	error = err => {
		replaceHTML(document.getElementById("app"), `
		<header class="header">
			<h1><a href=".">todos</a></h1>
			<p>${err}</p>
		</header>
		`);
	};
}();
