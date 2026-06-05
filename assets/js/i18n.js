// Language state + UI chrome strings. Persists choice; updates <html lang>.
const KEY = 'egi:v1:lang';
const STRINGS = {
  zh: { allLessons: '全部课程', search: '搜索课程…', progress: '进度', overview: '概览', concepts: '知识点', examples: '例句', quiz: '练习', dialogue: '对话', prev: '上一课', next: '下一课', notFound: '未找到该课程', backHome: '返回首页', retry: '重试', check: '检查', reveal: '显示答案', source: '原视频', resetProgress: '重置进度', legend: '图例', complete: '标记完成', completed: '已完成', lessons: '课', done: '已学完', tagline: '从英语兔语法系列改编的互动式双语语法课程' },
  en: { allLessons: 'All lessons', search: 'Search lessons…', progress: 'Progress', overview: 'Overview', concepts: 'Concepts', examples: 'Examples', quiz: 'Quiz', dialogue: 'Dialogue', prev: 'Previous', next: 'Next', notFound: 'Lesson not found', backHome: 'Back to home', retry: 'Retry', check: 'Check', reveal: 'Reveal answer', source: 'Source video', resetProgress: 'Reset progress', legend: 'Legend', complete: 'Mark complete', completed: 'Completed', lessons: 'lessons', done: 'done', tagline: 'An interactive bilingual grammar course adapted from the English Rabbit series' },
};
let lang = localStorage.getItem(KEY) || 'zh';
export function getLang() { return lang; }
export function otherLang() { return lang === 'zh' ? 'en' : 'zh'; }
export function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || key; }
export function pick(biling) { return biling ? (biling[lang] ?? biling.en ?? biling.zh ?? '') : ''; }
export function setLang(next) {
  lang = next; localStorage.setItem(KEY, next);
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  document.dispatchEvent(new CustomEvent('langchange'));
}
export function toggleLang() { setLang(otherLang()); }
export function initLang() { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }
