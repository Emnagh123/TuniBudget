import { formatMillimes } from "../utils/money.js";

/** Ranked horizontal bars: one hue, the length carries the amount. */
export default function CategoryBars({ items }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <ul className="bars">
      {items.map((item) => (
        <li key={item.categoryId} className="bars__row">
          <span>{item.name}</span>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: (item.total / max) * 100 + "%" }} />
          </span>
          <span className="bars__value num">{formatMillimes(item.total)}</span>
        </li>
      ))}
    </ul>
  );
}
