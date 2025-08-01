import Link from 'next/link';
import ThemeChanger from '@/components/ThemeChanger';

export default function AppNavbar() {
  return (
    <nav className="navbar navbar-expand-md border-bottom shadow">
      <div className="container">
        <Link href="/" className="navbar-brand fw-bold">
          {/* <Image src="/madarin.png" alt="App Icon" width="30" height="30" className="d-inline-block align-top" /> */}
          {/* <span style={{ color: "#A49371" }}>TC</span> */}
          Tone Coach
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item my-auto">
              <Link href="/record" className="nav-link" passHref>
                Practice
              </Link>
            </li>
          </ul>
          <ul className="navbar-nav ms-auto">
            <li className="nav-item my-auto ms-2 me-1">
              <Link href="https://github.com/marcelritzschke/tone-coach" className='nav-link' target="_blank">
                <i className="bi bi-github"></i>
              </Link>
            </li>
            <li className="my-auto me-1 pt-1">
              <div className="vr"></div>
            </li>
            <li className="nav-item my-auto">
              <ThemeChanger />
            </li>
            {/* <li className="nav-item my-auto ms-3">
              <SignInOut />
            </li> */}
          </ul>
        </div>
      </div>
    </nav>
  );
}
