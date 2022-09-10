import { createContext, Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import cx from '../../../../lib/cx';
import s from './devtools.less';
import { flattenMsg } from './serialize';
import { Icon } from '../../../icon/icon';

function isPrimitive(v) {
	switch (typeof v) {
		case 'boolean':
		case 'number':
		case 'string':
		case 'undefined':
			return true;
		default:
			return v === null;
	}
}

/**
 * @param {{ hub: EventTarget }} props
 */
export function Console({ hub }) {
	const [msgs, setMsgs] = useState([]);
	const [filter, setFilters] = useState('*');

	useEffect(() => {
		/** @type {import("./devtools-types").ConsoleItem | undefined} */
		let last;
		const listenToConsole = type => event => {
			const args = event.detail;
			if (args.length === 1 && isPrimitive(args[0])) {
				if (
					last !== undefined &&
					last.type === type &&
					last.value === args[0]
				) {
					setMsgs(prev => {
						if (!prev.length) return prev;
						const l = prev[prev.length - 1];
						l.count++;
						return prev.slice();
					});
				} else {
					last = { type, value: args[0] };
					setMsgs(prev => [...prev, { type, value: args, count: 0 }]);
				}
			} else {
				last = undefined;
				setMsgs(prev => {
					return [...prev, { type, value: args, count: 0 }];
				});
			}
		};

		hub.addEventListener('log', listenToConsole('log'));
		hub.addEventListener('info', listenToConsole('info'));
		hub.addEventListener('warn', listenToConsole('warn'));
		hub.addEventListener('error', listenToConsole('error'));
		hub.addEventListener('console-clear', () => {
			setMsgs([]);
			last = undefined;
		});
	}, []);

	const filtered = msgs.filter(msg => {
		if (filter === '*') return true;
		if (filter === 'error' && msg.type === 'error') return true;
		if (filter === 'warn' && msg.type === 'warn') return true;
		return false;
	});

	return (
		<div class={s.devtools}>
			<div class={s.devtoolsBar}>Console</div>
			<div class={s.consoleWrapper}>
				<div class={s.devtoolsActions}>
					<button class={s.devtoolsBtn} onClick={() => setMsgs([])}>
						<Icon icon="block" />
					</button>
					<div class={s.filter} aria-label="Console Filters">
						<button
							onClick={() => setFilters('*')}
							class={cx(s.filterBtn, filter === '*' && s.filterBtnActive)}
						>
							All
						</button>
						<button
							class={cx(s.filterBtn, filter === 'error' && s.filterBtnActive)}
							onClick={() => setFilters('error')}
						>
							Errors
						</button>
						<button
							class={cx(s.filterBtn, filter === 'warn' && s.filterBtnActive)}
							onClick={() => setFilters('warn')}
						>
							Warnings
						</button>
					</div>
				</div>
				<div class={s.console}>
					{filtered.length === 0 && (
						<div class={cx(s.italic, s.consoleMsg, s.consoleHint)}>
							Console was cleared
						</div>
					)}
					{filtered.map((msg, i) => {
						return (
							<Message
								key={i}
								type={msg.type}
								value={msg.value[0]}
								count={msg.count}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/**
 * @param {{type: import("./devtools-types").ConsoleMethod, value: number}} props
 */
function ConsoleIcon({ type, value }) {
	let children = (
		<span
			class={cx(
				s.consoleCount,
				type === 'warn'
					? s.consoleCountWarn
					: type === 'error'
					? s.consoleCountError
					: s.consoleCountInfo
			)}
		>
			<span>{value + 1}</span>
		</span>
	);
	if (value === 0) {
		if (type === 'error') {
			children = <Icon class={s.consoleIconError} icon="error" size="small" />;
		} else if (type === 'warn') {
			children = <Icon class={s.consoleIconWarn} icon="warn" size="small" />;
		} else if (type === 'info') {
			children = <Icon class={s.consoleIconInfo} icon="info" size="small" />;
		} else {
			children = <span class={s.consoleCountEmpty} />;
		}
	}

	return <span class={s.consoleIcon}>{children}</span>;
}

/**
 * @param {{ type: string, value: any[], count: number} } props
 */
function Message({ type, value, count }) {
	const out = [];
	const [show, setShow] = useState(new Set(['']));
	flattenMsg(value, show, out);

	console.log({ out, value, shown: show });

	return (
		<div
			class={cx(
				type == 'warn' && s.consoleWarn,
				type == 'error' && s.consoleError
			)}
		>
			{out.map(row => {
				return (
					<MessageItem
						key={row.key}
						type={type}
						id={row.key}
						value={row.value}
						count={count}
						level={row.level}
						show={show}
						setShow={setShow}
					/>
				);
			})}
		</div>
	);
}

function MessageItem({ type, id, value, level, count, show, setShow }) {
	const collapsible =
		value !== null && value !== undefined && typeof value === 'object';

	return (
		<div
			class={cx(
				s.consoleMsg,
				collapsible && count === 0 && s.consoleMsgCollapsible
			)}
		>
			<ConsoleIcon value={count} type={type} />
			<span class={s.consolePreview}>
				{collapsible ? (
					<button
						class={s.collapseBtn}
						onClick={() => {
							setShow(p => {
								console.log(id, new Set(p).has(id));
								const next = new Set(p);
								if (next.has(id)) {
									next.delete(id);
								} else {
									next.add(id);
								}
								return next;
							});
						}}
					>
						<span class={s.collapseIcon}>{show.has(id) ? '▶' : '▼'}</span>

						{generatePreview(value)}
					</button>
				) : (
					generatePreview(value)
				)}
			</span>
		</div>
	);
}

export function generatePreview(value, level = 0, end = false) {
	if (value === null || value === undefined) {
		return String(value);
	}

	switch (typeof value) {
		case 'number':
		case 'boolean':
			return <span class={s.primitive}>{String(value)}</span>;
		case 'string':
			return level === 0 ? value : <span class={s.string}>'{value}'</span>;
	}

	if (Array.isArray(value)) {
		if (end) return `Array(${value.length})`;
		return `[TODO]`;
	}

	const keys = Object.keys(value);

	if (end) {
		return (
			<span class={cx(level === 0 && s.italic)}>
				<span class={s.bright}>{'{'}</span>
				{keys.length > 0 ? '…' : ''}
				<span class={s.bright}>{'}'}</span>
			</span>
		);
	}

	return (
		<span class={cx(level === 0 && s.italic)}>
			<span class={s.bright}>{'{'}</span>
			{keys.map(k => {
				return (
					<>
						<span class={s.consoleDim}>{k}</span>:{' '}
						{generatePreview(value[k], level + 1, true)}
					</>
				);
			})}
			<span class={s.bright}>{'}'}</span>
		</span>
	);
}