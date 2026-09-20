"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus, Send, Sparkles } from 'lucide-react';
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
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState('');
  const [asking, setAsking] = useState(false);
  const askAbort = useRef<AbortController | null>(null);
  const context = getCookingContext(title, step, ingredients);
  const profile = getLocalUserProfile();
  const alternatives = getSafeSubstitutions(missing, ingredients, profile, title);
  const actions = issue === 'salty' ? context.soup ? copy.saltySoup : copy.saltyOther
    : issue === 'watery' ? context.deepFrying ? copy.hotOil : context.soup ? copy.waterySoup : copy.wateryOther
      : issue === 'burnt' ? copy.burntSteps : context.shellfish ? copy.shellfishSteps : copy.heatSteps;
  useEffect(() => () => {
    const controller = askAbort.current;
    askAbort.current = null;
    controller?.abort();
  }, []);
  const askAi = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAnswer('');
    setAskError('');
    askAbort.current?.abort();
    const controller = new AbortController();
    askAbort.current = controller;
    try {
      const response = await fetch('/api/recipes/cooking-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          title,
          step,
          stepNumber: index + 1,
          ingredients,
          language,
          profile: {
            dietaryRestrictions: profile.dietaryRestrictions || [],
            excludedIngredients: profile.excludedIngredients || [],
            allergies: profile.allergies || [],
          },
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.answer !== 'string') throw new Error(data.error || copy.aiError);
      setAnswer(data.answer);
    } catch (error) {
      if (controller.signal.aborted) return;
      setAskError(error instanceof Error ? error.message : copy.aiError);
    } finally {
      if (askAbort.current === controller) {
        askAbort.current = null;
        setAsking(false);
      }
    }
  };

  return <HelpDialog title={copy.title} onClose={onClose}>
    <div className={styles.context}><small>{copy.context} · {index + 1}</small><strong>{title}</strong><p>{step}</p></div>
    <form className={styles.aiBox} onSubmit={askAi}>
      <label htmlFor="cooking-ai-question"><Sparkles size={17} />{copy.aiTitle}</label>
      <p>{copy.aiHint}</p>
      <div className={styles.aiInputRow}>
        <input id="cooking-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={240} placeholder={copy.aiPlaceholder} autoComplete="off" />
        <button type="submit" disabled={asking || !question.trim()} aria-label={copy.aiAsk}>
          {asking ? <Loader2 className="spinner" size={18} /> : <Send size={18} />}
        </button>
      </div>
      {asking && <span className={styles.aiStatus} role="status">{copy.aiThinking}</span>}
      {answer && <div className={styles.aiAnswer} role="status"><Sparkles size={16} /><p>{answer}</p></div>}
      {askError && <p className={styles.aiError} role="alert">{askError}</p>}
    </form>
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
