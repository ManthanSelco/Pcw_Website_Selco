import YouTube from './YouTube.jsx';

// Plays an event recording from any site:
//  YouTube -> YouTube player, Vimeo / Google Drive -> their player, .mp4 -> browser player,
//  Spotify / SoundCloud / Apple Podcasts / .mp3 -> their audio player,
//  anything else (Facebook, a news site...) -> poster with a "Watch the recording" button (new tab).
export default function VideoPlayer({ video, title, poster, listen }) {
  if (!video?.url) return null;
  const k = video.kind;
  if (k === 'youtube' && video.youtubeId) return <YouTube id={video.youtubeId} title={title} poster={poster} />;
  if ((k === 'vimeo' || k === 'drive') && video.embed)
    return (
      <div className="pcw-yt">
        <iframe src={video.embed} title={title} loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
      </div>
    );
  if (['spotify', 'soundcloud', 'apple'].includes(k) && video.embed)
    return (
      <div className={`pcw-rec-embed is-audio${video.tall ? ' is-tall' : ''}`}>
        <iframe src={video.embed} title={title} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
      </div>
    );
  if (k === 'audio') return <audio className="pcw-rec-audio" src={video.src || video.url} controls preload="metadata" />;
  if (k === 'video') return <video className="pcw-video-file" src={video.url} poster={poster || undefined} controls preload="metadata" playsInline />;
  return (
    <a className="pcw-video-link" href={video.url} target="_blank" rel="noopener noreferrer">
      {poster ? <img src={poster} alt="" /> : <span className="pcw-video-link-bg" />}
      <span className="pcw-video-link-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
        {listen ? 'Listen to the recording' : 'Watch the recording'} <span aria-hidden="true">↗</span>
      </span>
    </a>
  );
}
