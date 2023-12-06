import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useDocumentLocationHash, useObservableValue} from "./hooks";
import {watchQuery, watchSubject} from "../js/query";
import {map, NEVER} from "rxjs";
import {matches, processHash} from "../js/helpers";
import {initModel} from "../js/model";

function App() {
    const hash = useDocumentLocationHash();
    const [{model, modelId}, setModelAndId] = useState({});
    const [filter, setFilter] = useState("");
    const [error, setError] = useState("");
    const pre = useRef({});
    useEffect(() => {
        async function onNextHash() {
            const location = processHash(hash);
            if (pre.current.modelId !== location.modelId) {
                pre.current.model?.close().catch(console.error);
                pre.current = {
                    model: await initModel(location.modelId, location.isNew),
                    modelId: location.modelId
                };
                setModelAndId(pre.current);
            }
            setFilter(location.filter);
        }
        onNextHash().catch(setError)
    }, [hash]);
    // noinspection JSCheckFunctionSignatures
    const summary = useObservableValue(useMemo(
        () => model != null ? watchQuery(
            model,
            async state =>
                await state.read({
                    "@construct": {
                        "@id": "todos",
                        "@list": {"?i": {"@id": "?", "completed": "?c"}}
                    }
                })
        ).pipe(map(([todos]) => todos?.["@list"] ?? [])) : NEVER,
        [model]
    ), []);
    return error ? (
        <header className="header">
            <h1><a href=".">model</a></h1>
            <p>{error}</p>
        </header>
    ) : (
        <>
            <Header model={model}></Header>
            <Main model={model} summary={summary} filter={filter}></Main>
            <Footer model={model} modelId={modelId} summary={summary}></Footer>
        </>
    );
}

/**
 * @param {MeldClone} [model]
 * @constructor
 */
function Header({model}) {
    return <header className="header">
        <h1><a href=".">Todos</a></h1>
        <progress
            max="100"
            data-todo="progress"
            style={{width: '100%'}}
            hidden={model != null}>
            Loading...
        </progress>
        <input
            placeholder="What needs to be done?"
            autoFocus
            className="new-todo"
            disabled={model == null}
            onKeyUp={(e) => {
                const input = /**@type HTMLInputElement*/e.target;
                if (e.key === "Enter" && input.value.length) {
                    model.write({
                        "@id": "todos",
                        "@list": {
                            0: {
                                title: input.value,
                                completed: false,
                                "@id": "id_" + Date.now(),
                            }
                        }
                    }).catch(console.error);
                    input.value = "";
                }
            }}
        />
    </header>;
}

/**
 * This section should be hidden by default and shown when there are model
 * @param {MeldClone} model
 * @param {{'@id': string, completed: boolean}[]} summary
 * @param {string} filter
 * @constructor
 */
function Main({model, summary, filter}) {
    const todoComponents = summary
        .filter(summary => matches(summary, filter))
        .map(todo =>
            <TodoLi key={todo['@id']} id={todo['@id']} model={model}/>);
    return <section
        className="main"
        style={{display: summary.length ? 'block' : 'none'}}>
        <input
            id="toggle-all"
            className="toggle-all"
            type="checkbox"
            checked={summary.every(({completed}) => completed)}
            onChange={() => {
                const anyActive = summary.some(({completed}) => !completed);
                model.write({
                    // TODO: This ought to be possible with @update
                    "@delete": {"@id": "?id", completed: !anyActive},
                    "@insert": {"@id": "?id", completed: anyActive},
                    "@where": {"@id": "?id", completed: !anyActive}
                }).catch(console.error);
            }}
        />
        <label htmlFor="toggle-all">Mark all as complete</label>
        <ul className="todo-list">{todoComponents}</ul>
    </section>;
}

/**
 * @param {string} id
 * @param {MeldClone} model
 * @constructor
 */
function TodoLi({model, id}) {
    const [editing, setEditing] = useState(false);
    const todo = useObservableValue(
        useMemo(() =>
            watchSubject(model, id), [model, id]),
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
                    model.write({
                        "@update": {"@id": id, completed: !todo.completed}
                    }).catch(console.error)
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
                    model.write({
                        "@delete": {
                            "@id": "todos",
                            "@list": {"?": {"@id": id, "?": "?"}}
                        }
                    }).catch(console.error);
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
                    model.write({
                        "@update": {"@id": id, title: input.value}
                    }).catch(console.error);
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
 * This footer should be hidden by default and shown when there are model
 * @param {MeldClone} model
 * @param {string} modelId
 * @param {{'@id': string, completed: boolean}[]} summary
 * @constructor
 */
function Footer({model, modelId, summary}) {
    const count = summary.length;
    return <footer
        className="footer"
        style={{display: count ? 'block' : 'none'}}>
		<span className="todo-count">
			<strong>{count}</strong> item{count === 1 ? '' : 's'} left
		</span>
        <ul className="filters">
            <li><a className="selected" href={`#/${modelId}/`}>All</a></li>
            <li><a href={`#/${modelId}/active`}>Active</a></li>
            <li><a href={`#/${modelId}/completed`}>Completed</a></li>
        </ul>
        <button
            className="clear-completed"
            style={{
                display: summary.some(
                    ({completed}) => completed
                ) ? 'block' : 'none'
            }}
            onClick={() => {
                model.write({
                    "@delete": {
                        "@id": "todos",
                        "@list": {"?": {completed: true, "?": "?"}}
                    }
                }).catch(console.error);
            }}>
            Clear completed
        </button>
    </footer>
}

const appSection = document.querySelector('.todoapp');
appSection.replaceChildren();
const root = createRoot(appSection);
root.render(<App/>);
