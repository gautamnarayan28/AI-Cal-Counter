type IconName = "home" | "logs" | "progress" | "insights" | "camera" | "arrow";
const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
  logs: <><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M9 3v18M13 8h4M13 12h4M3 8h4M3 16h4" /></>,
  progress: <><path d="M4 5v15h16M8 14l4-5 4 3 4-7" /></>,
  insights: <><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 .8-1 1.5-1 2H9c0-.5 0-1.2-1-2Z" /></>,
  camera: <><path d="M8 5l1.5-2h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.5" r="4" /></>,
  arrow: <path d="M12 19V5m-5 5 5-5 5 5" />,
};
export default function JournalIcon({ name }: { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
