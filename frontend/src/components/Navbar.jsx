import { useState } from 'react'; // Don't forget this!

// Receive functions (getTheJoke, toggleQR) and data (userCount, joke) as PROPS
function Navbar({ userCount, joke, getTheJoke, isJokeLoading, onOpenQR }) {

  return (
    // 2. CRITICAL CLASS: 'navbar-expand-lg'
    // Without this, the menu is ALWAYS hidden (collapsed) regardless of screen size.
    <nav className="navbar navbar-expand-lg border-bottom border-secondary px-3 glass-bg">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold text-info">RexOrion</span>

        {/* Toggler Button */}
        <button className="btn btn-primary navbar-toggler bg-secondary-subtle" type="button" data-bs-toggle="collapse" data-bs-target="#collapseNavbar" aria-expanded="false" aria-controls="collapseNavbar">
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible Content */}
        {/* 3. CHECK THIS LOGIC: If isNavOpen is true, we add 'show' */}
        <div className="collapse navbar-collapse" id='collapseNavbar'>
          
          <ul className="navbar-nav me-auto align-items-md-end align-items-lg-center flex-md-column flex-lg-row">
             {/* ... Joke logic using props.joke, props.getTheJoke ... */}
             <li className="nav-item text-white-50">
               {joke ? `"${joke}"` : "Need a laugh?"}
               <button onClick={getTheJoke} className="btn btn-sm text-warning ms-2">
                 {isJokeLoading ? '...' : '😂'}
               </button>
             </li>
             <li>
              <select className='bg-transparent border-0 text-white' onChange={() => {}}>
                <option value="Summer">Summer</option>
                <option value="monsoon">Monsoon</option>
                <option value="Winter">Winter</option>
              </select>
             </li>
             <li className='nav-item'>
                <button className="btn btn-outline-light" onClick={onOpenQR}>QR Tool</button>
             </li>
             <li className='nav-item m-1'>
                <span className="badge bg-success p-2">
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