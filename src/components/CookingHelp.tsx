"use client";

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cookingHelpCopy } from '@/lib/i18n/cookingHelp';
import { COOKING_ISSUES, getCookingContext, getSafeSubstitutions, type CookingIssue } from '@/lib/cookingHelp';
import { getLocalUserProfile, addLocalShoppingItem, getLocalShoppingItems } from '@/lib/storage';
import HelpDialog from './HelpDialog';
import styles from './CookingHelp.module.css';

export default function CookingHelp({ title, step, index, ingredients, onClose }: {
  title: string; step: string; index: number; ingredients: { name: string; amount: string }[]; onClose: () => void;
}) {
  const { language } = useLanguage();
  const copy = cookingHelpCopy[language];
  const [issue, setIssue] = useState<CookingIssue>('missing');
  const [missing, setMissing] = useState('');
  const [added, setAdded] = useState(false);
  const context = getCookingContext(title, step, ingredients);
  const alternatives = getSafeSubstitutions(missing, ingredients, getLocalUserProfile(), title);
  const actions = issue === 'salty' ? context.soup ? copy.saltySoup : copy.saltyOther
    : issue === 'watery' ? context.deepFrying ? copy.hotOil : context.soup ? copy.waterySoup : copy.wateryOther
      : issue === 'burnt' ? copy.burntSteps : context.shellfish ? copy.shellfishSteps : copy.heatSteps;
  return <HelpDialog title={copy.title} onClose={onClose}>
    <div className={styles.context}><small>{copy.context} · {index + 1}</small><strong>{title}</strong><p>{step}</p></div>
    <p className={styles.label}>{copy.choose}</p>
    <div className={styles.issues}>{COOKING_ISSUES.map((key) => <button type="button" key={key} aria-pressed={issue === key} onClick={() => setIssue(key)}>{copy[key]}</button>)}</div>
    <div className={styles.answer}>
      {issue === 'missing' ? <>
        <label className={styles.label} htmlFor="help-missing-ingredient">{copy.ingredient}</label>
        <select id="help-missing-ingredient" value={missing} onChange={(e) => { setMissing(e.target.value); setAdded(false); }}>
          <option value="">{copy.select}</option>
          {ingredients.map((item, i) => <option key={i} value={item.name}>{item.name} · {item.amount}</option>)}
        </select>
        {missing && <>
          {alternatives.length > 0 ? <>
            <h3>{copy.alternatives}</h3>
            <ul>{alternatives.map((candidate) => <li key={candidate.en}><strong>{candidate[language]}</strong><p>{copy[candidate.note]}</p></li>)}</ul>
            <p className={styles.note}>{copy.substituteNote}</p>
          </> : <p>{copy.noAlternative}</p>}
          <button type="button" className={styles.shopping} disabled={added} onClick={() => {
            if (!getLocalShoppingItems().some((item) => !item.is_completed && item.name.trim() === missing.trim())) addLocalShoppingItem(missing);
            setAdded(true);
          }}>{added ? <Check size={17} /> : <Plus size={17} />}{added ? copy.added : copy.addShopping}</button>
        </>}
      </> : issue === 'words' ? <dl className={styles.terms}>{copy.terms.map(({ term, body }) => <div key={term}><dt>{term}</dt><dd>{body}</dd></div>)}</dl>
        : <ol className={styles.steps}>{actions.map((action) => <li key={action}>{action}</li>)}</ol>}
      {issue === 'heat' && <a className={styles.source} href={context.shellfish ? 'https://www.mhlw.go.jp/web/t_doc?dataId=00tb9161&dataType=1&pageNo=1' : 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/01_00006.html'} target="_blank" rel="noreferrer">{copy.source}</a>}
    </div>
  </HelpDialog>;
}
