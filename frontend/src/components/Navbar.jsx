import { useState } from 'react'; // Don't forget this!

// Receive functions (getTheJoke, toggleQR) and data (userCount, joke) as PROPS
function Navbar({ userCount, joke, getTheJoke, isJokeLoading, onOpenQR }) {
  
  // 1. STATE MUST BE HERE (or passed down)
//   const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    // 2. CRITICAL CLASS: 'navbar-expand-lg'
    // Without this, the menu is ALWAYS hidden (collapsed) regardless of screen size.
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary px-3">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold text-info">RexOrion</span>

        {/* Toggler Button */}
        <button className="btn btn-primary navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#collapseNavbar" aria-expanded="false" aria-controls="collapseNavbar">
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible Content */}
        {/* 3. CHECK THIS LOGIC: If isNavOpen is true, we add 'show' */}
        <div className="collapse navbar-collapse" id='collapseNavbar'>
          
          <ul className="navbar-nav me-auto">
             {/* ... Joke logic using props.joke, props.getTheJoke ... */}
             <li className="nav-item text-white-50">
               {joke ? `"${joke}"` : "Need a laugh?"}
               <button onClick={getTheJoke} className="btn btn-sm text-warning ms-2">
                 {isJokeLoading ? '...' : '😂'}
               </button>
             </li>
             <li className='nav-item text-white-50'>
                <button className="btn btn-outline-light" onClick={onOpenQR}>
                QR Tool
                </button>
             </li>
             <li className='nav-item text-white-50 py-1'>
                <span className="badge bg-success py-2">
                Online: {userCount}
                </span>
             </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;