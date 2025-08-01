
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <div className="container text-center mt-5">
        <h1>Welcome to Tone Trainer</h1>
        <p>Practice Chinese tones with phrase-level accuracy.</p>
        <Link href="/record" className="btn btn-primary btn-lg">
          Start Practicing
        </Link>
      </div>
    </>
  );
}
