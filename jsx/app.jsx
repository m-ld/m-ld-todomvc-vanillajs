import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import useGlobalStore from "./GlobalStore";

function App() {
	const {todos, filter, error, ready} = useGlobalStore();
	return error ? (
		<header className="header">
			<h1><a href=".">todos</a></h1>
			<p>{error}</p>
		</header>
	) : (
		<>
			<Header todos={todos} ready={ready}></Header>
			<Main todos={todos} filter={filter}></Main>
			<Footer todos={todos}></Footer>
		</>
	);
}

/**
 * @param {TodoStore} todos
 * @param {boolean} ready
 * @constructor
 */
function Header({todos, ready}) {
	return <header className="header">
		<h1><a href=".">todos</a></h1>
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
					todos.add({title: input.value});
					input.value = "";
				}
			}}
		/>
	</header>;
}

/**
 * This section should be hidden by default and shown when there are todos
 * @param {TodoStore} todos
 * @param {string} filter
 * @constructor
 */
function Main({todos, filter}) {
	const filteredTodos = todos.all(filter).map(
		todo => <TodoLi key={todo['@id']} todo={todo} todos={todos}/>);
	return <section
		className="main"
		style={{display: todos.all().length ? 'block' : 'none'}}>
		<input
			id="toggle-all"
			className="toggle-all"
			type="checkbox"
			checked={todos.isAllCompleted()}
			onChange={() => {
				todos.toggleAll();
			}}
		/>
		<label htmlFor="toggle-all">Mark all as complete</label>
		<ul className="todo-list">{filteredTodos}</ul>
	</section>;
}

/**
 * @param {Todo} todo
 * @param {TodoStore} todos
 * @constructor
 */
function TodoLi({todos, todo}) {
	const [editing, setEditing] = useState(false);
	/** @type {React.MutableRefObject<HTMLInputElement>} */
	const inputRef = useRef();
	return <li className={editing ? 'editing' : ''}>
		<div className={`view ${todo.completed ? 'completed' : ''}`}>
			<input
				className="toggle"
				type="checkbox"
				checked={todo.completed}
				onChange={() => {
					todos.toggle(todo)
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
					todos.remove(todo);
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
					todos.update({...todo, title: input.value});
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
 * This footer should be hidden by default and shown when there are todos
 * @param {TodoStore} todos
 * @constructor
 */
function Footer({todos}) {
	const count = todos.all("active").length;
	return <footer
		className="footer"
		style={{display: todos.all().length ? 'block' : 'none'}}>
		<span className="todo-count">
			<strong>{count}</strong> item{count === 1 ? '' : 's'} left
		</span>
		<ul className="filters">
			<li><a className="selected" href={`#/${todos.id}/`}>All</a></li>
			<li><a href={`#/${todos.id}/active`}>Active</a></li>
			<li><a href={`#/${todos.id}/completed`}>Completed</a></li>
		</ul>
		<button
			className="clear-completed"
			style={{display: todos.hasCompleted() ? 'block' : 'none'}}
			onClick={() => {
				todos.clearCompleted();
			}}>
			Clear completed
		</button>
	</footer>
}

const appSection = document.querySelector('.todoapp');
appSection.replaceChildren();
const root = createRoot(appSection);
root.render(<App/>);
