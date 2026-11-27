# Form controls

Use the named exports from `components/ui`. `components/common` retains the existing imports as compatibility adapters. Presentation lives in `Controls.module.css`; all control colors, dimensions, typography, spacing, focus and popup tokens come from `src/index.css`.

| Component | Contract |
|---|---|
| `DatePicker` | ISO `YYYY-MM-DD` values; `onChange(event)`; `min`/`max` aliases for `minDate`/`maxDate`; `disabledDates` as ISO string array or predicate receiving an ISO string. Vietnamese Monday-first calendar, Today/Clear actions and keyboard navigation. |
| `DateTimePicker` | Local `YYYY-MM-DDTHH:mm` strings, with seconds when `step < 60`; independent date and keyboard-editable time. No timezone conversion in submitted values. |
| `TimePicker` / `MonthPicker` | `HH:mm` (or `HH:mm:ss`) / `YYYY-MM`; same event and form contract. |
| `Select` | `options` as `[value, label]` tuples or `{value, label, disabled}` objects. Existing option children are supported as data. `searchable` enables a combobox; typing alone does not change the selected form value. |
| `Checkbox` / `Radio` / `Switch` | Native checked/name/value/ref and change-event semantics; custom appearance. Checkbox also supports `indeterminate`. Labels may wrap the control or use the `label` prop. |
| `Input` / `NumberInput` | Standard input props. `Input` routes specialized types to the corresponding primitive. NumberInput preserves native numeric validity and keyboard behavior while hiding browser spinner buttons. |
| `FileInput` | Native FileList events, `inputRef` or `ref`, `accept`, `multiple`, `required`; optional `selectedFileName` and `chooseText`. The native OS file chooser remains necessary. |
| `Slider` | Standard range values/step/change events with a themed track/thumb. |
| `Button` | `primary`, `secondary`, `outline`, `ghost`, `danger`; `sm`/`md`/`lg`; `loading`/`loadingText`. Default type is button. `custom` retains the layout of existing tabs, menu items, schedule cells and image actions while sharing focus/disabled/active behavior and a minimum hit area. |
| `FormField` | Connects labels, hints and inline errors to the control, including specialized controls. |

Date and select popups use React Aria for focus, keyboard navigation, dismissal, placement and localization. Popups inside a native dialog are portalled into that dialog so the browser top layer does not hide or disable them. No global dark theme is present; sidebar triggers use existing sidebar tokens, and popup surfaces use the common surface tokens.

Form bridges are visually hidden native fields used for `FormData`, `name`, constraint validation, `form.elements`, reset and refs. Their browser picker UI is never shown. For controlled components, values accepted by the parent remain authoritative. Uncontrolled components restore `defaultValue` after native reset; date/time values stay local strings. Existing JSX option children are read as data and do not render a native dropdown panel.

Run `npm run lint:controls` to prevent native input/select/button callsites outside these primitives. `/dev/style-guide` includes interactive examples covering form submission, reset, disabled fieldsets and popup behavior.

Admin table utilities: `ActionMenu({label, items})` accepts `{id, label, onAction, disabled, danger}` items and owns no business behavior. `ScrollArea({label, children, className, viewportClassName})` provides edge fades, Shift+wheel and a persistent horizontal range/scrollbar when WebKit overlay scrollbars would auto-hide; ordinary native scrollbars remain on platforms with a real gutter. The range is unnamed, so it never adds form data. It keeps mouse, touch and keyboard scrolling synchronized.

`common/Tabs` supports either the existing `items[].content` mounted-panel API, or `children` for an externally controlled active panel. It constrains overflow to the horizontal axis, uses an absolute indicator and reveals the active item without moving the page.
