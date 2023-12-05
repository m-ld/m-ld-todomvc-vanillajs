import React, {useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useBehaviour, useFilter, useObservableError, useObservableValue, useStore} from "./helpers";
import {TodoStore} from "../js/store";

function App() {
	const store = useStore();
	const ready = useBehaviour(store);
	const error = useObservableError(store);
	return error ? (
		<header className="header">
			<h1><a href=".">store</a></h1>
			<p>{error}</p>
		</header>
	) : (
		<>
			<Header store={store} ready={ready}></Header>
			<Main store={store}></Main>
			<Footer store={store}></Footer>
		</>
	);
}

/**
 * @param {TodoStore} store
 * @param {boolean} ready
 * @constructor
 */
function Header({store, ready}) {
	return <header className="header">
		<h1><a href=".">Todos</a></h1>
		<progress
			max="100"
			data-todo="progress"
			style={{width: '100%'}}
			hidden={ready}>
			Loading...
		</progress>
		<input
			placeholder="What needs to be done?"
			autoFocus
			className="new-todo"
			disabled={!ready}
			onKeyUp={(e) => {
				const input = /**@type HTMLInputElement*/e.target;
				if (e.key === "Enter" && input.value.length) {
					store.add({title: input.value});
					input.value = "";
				}
			}}
		/>
	</header>;
}

/**
 * This section should be hidden by default and shown when there are store
 * @param {TodoStore} store
 * @constructor
 */
function Main({store}) {
	const filter = useFilter();
	const todoSummary = useObservableValue(store.watchSummary, []);
	const todoComponents = todoSummary
		.filter(summary => TodoStore.matches(summary, filter))
		.map(todo => <TodoLi key={todo['@id']} id={todo['@id']} store={store}/>);
	return <section
		className="main"
		style={{display: todoSummary.length ? 'block' : 'none'}}>
		<input
			id="toggle-all"
			className="toggle-all"
			type="checkbox"
			checked={todoSummary.every(({completed}) => completed)}
			onChange={() => {
				store.toggleAll(todoSummary.some(({completed}) => !completed));
			}}
		/>
		<label htmlFor="toggle-all">Mark all as complete</label>
		<ul className="todo-list">{todoComponents}</ul>
	</section>;
}

/**
 * @param {string} id
 * @param {TodoStore} store
 * @constructor
 */
function TodoLi({store, id}) {
	const [editing, setEditing] = useState(false);
	const todo = useObservableValue(
		useMemo(() => store.watchTodo(id), [store, id]),
		{completed: false, title: "loading..."}
	);
	/** @type {React.MutableRefObject<HTMLInputElement>} */
	const inputRef = useRef();
	return <li className={editing ? 'editing' : ''}>
		<div className={`view ${todo.completed ? 'completed' : ''}`}>
			<input
				className="toggle"
				type="checkbox"
				checked={todo.completed}
				onChange={() => {
					store.toggle(todo)
				}}
			/>
			<label
				onDoubleClick={() => {
					setEditing(true)
					inputRef.current.focus();
				}}
			>{todo.title}</label>
			<button
				className="destroy"
				onClick={() => {
					store.remove(todo);
				}}>
			</button>
		</div>
		<input
			ref={inputRef}
			className="edit"
			defaultValue={todo.title}
			onKeyUp={e => {
				const input = inputRef.current;
				if (e.key === "Enter" && input.value) {
					store.update({...todo, title: input.value});
					setEditing(false);
				}
				if (e.key === "Escape") {
					input.blur();
				}
			}}
			onBlur={() => {
				setEditing(false);
			}}
		/>
	</li>;
}

/**
 * This footer should be hidden by default and shown when there are store
 * @param {TodoStore} store
 * @constructor
 */
function Footer({store}) {
	const todoSummary = useObservableValue(store.watchSummary, []);
	const count = todoSummary.length;
	return <footer
		className="footer"
		style={{display: count ? 'block' : 'none'}}>
		<span className="todo-count">
			<strong>{count}</strong> item{count === 1 ? '' : 's'} left
		</span>
		<ul className="filters">
			<li><a className="selected" href={`#/${store.id}/`}>All</a></li>
			<li><a href={`#/${store.id}/active`}>Active</a></li>
			<li><a href={`#/${store.id}/completed`}>Completed</a></li>
		</ul>
		<button
			className="clear-completed"
			style={{display: todoSummary.some(({completed}) => completed) ? 'block' : 'none'}}
			onClick={() => {
				store.clearCompleted();
			}}>
			Clear completed
		</button>
	</footer>
}

const appSection = document.querySelector('.todoapp');
appSection.replaceChildren();
const root = createRoot(appSection);
root.render(<App/>);
