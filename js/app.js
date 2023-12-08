import {getAppLocation, keyedElements, matches, processHash, replaceHTML} from "./helpers.js";
import {initModel} from "./model.js";
import {watchQuery, watchSubject} from "./query.js";
import {Subscription} from "rxjs";

const $ = keyedElements(document);

export default new class App {
	/**@type string*/filter;
	/**@type string*/modelId;
	/**@type MeldClone*/model;
	/**@type {{'@id': string, completed: boolean}[]}*/summary;
	todoSubs = new Subscription;

	constructor() {
		window.addEventListener("hashchange", this.onHashChange);
		this.onHashChange();
		$["new"].addEventListener("keyup", (e) => {
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
				$["new"].value = "";
			}
		});
		$["toggle-all"].addEventListener("click", () => {
			const anyActive = this.summary.some(({completed}) => !completed);
			this.model.write({
				"@delete": {"@id": "?id", completed: !anyActive},
				"@insert": {"@id": "?id", completed: anyActive}
			}).catch(this.error);
		});
		$["clear-completed"].addEventListener("click", () => {
			this.model.write({
				"@delete": {
					"@id": "todos",
					"@list": {"?": {completed: true, "?": "?"}}
				}
			}).catch(this.error);
		});
		const bindTodoEvent = (key, event, handler) => {
			$["list"].addEventListener(event, e => {
				if (e.target.matches(`[data-key="${key}"]`)) {
					const el = e.target.closest("[data-id]");
					handler(el.dataset.id, el, e);
				}
			});
		}
		bindTodoEvent("destroy", "click", id => {
			this.model.write({
				'@delete': {
					'@id': 'todos',
					'@list': {'?': {'@id': id, '?': '?'}}
				}
			}).catch(this.error);
		});
		bindTodoEvent("toggle", "click", (id, _, e) => {
			this.model.write({
				'@update': {'@id': id, completed: e.target.checked}
			}).catch(this.error);
		});
		bindTodoEvent("label", "dblclick", (_, li) => {
			this.setEditing(li);
		});
		bindTodoEvent("edit", "keyup", (id, li, e) => {
			const input = this.getTodo$(li)["edit"];
			if (e.key === "Enter" && input.value) {
				li.classList.remove("editing");
				this.model.write({
					'@update': {'@id': id, title: input.value}
				}).catch(this.error);
			}
			if (e.key === "Escape")
				document.activeElement.blur();
		});
		bindTodoEvent("edit", "focusout", (todo, li) => {
			if (li.classList.contains("editing"))
				this.refresh();
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
				$["filters"].querySelectorAll('a').forEach((el) => {
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
				).subscribe(([todos]) => {
					this.summary = todos?.["@list"] ?? [];
					this.refresh();
				});
			}).catch(this.error);
		} else {
			this.setActiveFilter(this.filter);
			this.refresh();
		}
	};

	setActiveFilter(filter) {
		$["filters"].querySelectorAll('a').forEach(el => {
			const selected = el.matches(`[href="#/${this.modelId}/${filter}"]`);
			el.classList[selected ? "add" : "remove"]("selected");
		});
	}

	getEditing() {
		const li = document.querySelector('.editing');
		if (li != null) {
			const editingId = li.dataset.id;
			const input = this.getTodo$(li)["edit"];
			const selection = [input.selectionStart, input.selectionEnd];
			return {
				id: editingId,
				restore: () => this.setEditing(editingId, ...selection)
			}
		}
	}

	setEditing(liOrId, selectionStart, selectionEnd) {
		const $todo = this.getTodo$(liOrId);
		if ($todo != null) {
			$todo.self.classList.add("editing");
			$todo["edit"].focus();
			$todo["edit"].setSelectionRange(selectionStart, selectionEnd);
			return $todo;
		}
	}

	getTodo$(liOrId) {
		const li = liOrId instanceof Element ? liOrId :
			document.querySelector(`[data-id="${liOrId}"]`);
		return li && keyedElements(li);
	}

	refresh() {
		const editing = this.getEditing(),
			anyCompleted = this.summary.some(({completed}) => completed),
			allCompleted = this.summary.every(({completed}) => completed),
			active = this.summary.filter(({completed}) => !completed);
		this.setActiveFilter(this.filter);
		this.todoSubs.unsubscribe();
		this.todoSubs = new Subscription;
		$["list"].replaceChildren(
			$["todo-template"],
			...this.summary
				.filter(item => matches(item, this.filter))
				.map(({"@id": id}) => {
					const templateFragment =
						$["todo-template"].content.cloneNode(true);
					const $li = keyedElements(templateFragment.querySelector("li"));
					$li.self.dataset.id = id;
					this.todoSubs.add(watchSubject(this.model, id).subscribe(todo => {
						$li.self.classList[todo.completed ? "add" : "remove"]("completed");
						$li["toggle"].checked = todo.completed;
						$li["label"].textContent = todo.title;
						$li["edit"].value = todo.title;
					}));
					return templateFragment;
				})
		);
		$["main"].style.display = this.summary.length ? "block" : "none";
		$["footer"].style.display = this.summary.length ? "block" : "none";
		$["clear-completed"].style.display = anyCompleted ? "block" : "none";
		$["toggle-all"].checked = allCompleted;
		replaceHTML($["count"], `
			<strong>${(active.length)}</strong>
			${active.length === 1 ? "item" : "items"} left
		`);
		$["new"].disabled = false;
		$["progress"].hidden = true;
		editing?.restore(); // TODO: What if no longer present (filtered out or removed)
	}

	error = err => {
		replaceHTML($["app"], `
		<header class="header">
			<h1><a href=".">todos</a></h1>
			<p>${err}</p>
		</header>
		`);
	};
}();
