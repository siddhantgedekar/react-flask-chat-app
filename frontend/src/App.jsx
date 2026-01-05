import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import io from 'socket.io-client'
import './App.css'

// connect to server OUTSIDE of the component so it doesn't reconnect, everytime you type
const BACKEND_URL = import.meta.env.PROD ? 'https://sids-worldchat.onrender.com' : ''; // for PROD vs DEV environment
const socket = io(BACKEND_URL) // adjust URL as needed

function App() {
  const [userCount, setUserCount] = useState(0);
  const [username, setUsername] = useState("");
  
  const [input, setInput] = useState("");
  const [worldInput, setWorldInput] = useState(""); // separate input for world

  const [messages, setMessages] = useState([]); // AI chat messages
  const [worldMessages, setWorldMessages] = useState([]); // World chat messages

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Refs are ONLY for scrolling now, not for hiding/showing
  const aiChatEndRef = useRef(null);
  const worldChatEndRef = useRef(null);

  useEffect(() => { // socket listener (the ear)
    socket.on('receive_message_from_server', (data) => {
      setWorldMessages((prev) => [...prev, data]);
    });
    socket.on('update_user_count', (data) => {
      setUserCount(data.count)
    });
    socket.on('load_history', (history) => {
      setWorldMessages(history);
    })

    return () => { // cleanup on unmount
      socket.off('receive_message_from_server');
      socket.off('update_user_count');
      socket.off('load_history');
    };
  }, []);

  const sendMessage = async () => { // function to send message to AI server
    const userInput = input; // store current input
    
    setInput(""); // clear input box

    if (!userInput.trim()) return;
    
    setMessages(prev => [...prev, { sender: "user", text: userInput }]); // Add USER message for AI chat
    setIsLoading(true); // loading...

    try { // handle error and fetch to backend
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
      });
      const data = await response.json(); // wait for response
      setMessages(prev => [...prev, { sender: "bot", text: data.reply }]); // add bot's response to messages state
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Error: Could not connect to server." }]);
    }
    setIsLoading(false);
  };

  const sendWorldMessage = () => { // function to send message to world/handle_message socket event
    if (!worldInput.trim()) return; // don't send empty messages

    socket.emit('send_message_to_server', { message: worldInput, username: username }); // send message to python/server via socket

    setWorldInput(""); // clear the input box of world chat
  }

  useEffect(() => { // Auto-Scroll to bottom whenever messages change
    if (activeTab === 'ai' && aiChatEndRef.current) aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'world' && worldChatEndRef.current) worldChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, worldMessages, activeTab]);

  async function handleLogin(e) {
    e.preventDefault(); // prevent page refresh
    if(!username.trim()) return alert("Enter a name!"); // validation alert prompt for user

    try { // call backend login endpoint
      const response = await fetch(`${BACKEND_URL}/login`, { // vite.config automatically redirects/forwards it to endpoint/API
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username }),
      })
      const data = await response.json(); // wait and then parse the json response

      if(response.ok) { // success!. Save username to state
        setUsername(data.username); // set username
        setIsLoggedIn(true); // mark logged in 'true'
      } else {
        alert(data.error); // show error message
      }
    } catch (error) { // handle error
      console.log("Login error:", error);
      alert("Server error. Is Python running?");
    }
  }

  if (!isLoggedIn) { // if isLoggedIn == false, we won't show chat UI (ik it's basic, but works)
    return (
      <div style={{
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#282c34',
        color: 'white'
      }}>
        <form onSubmit={handleLogin} style={{
          padding: '2rem', 
          border: '1px solid #444', 
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h2>Welcome to Sid's Chat</h2>
          <input 
            type="text" 
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '10px', fontSize: '1rem', marginBottom: '1rem' }}
          />
          <br />
          <button type="submit" style={{
            padding: '10px 20px', 
            cursor: 'pointer', 
            backgroundColor: '#61dafb', 
            border: 'none', 
            fontWeight: 'bold', 
            color: 'black'
          }}>
            Join Chat
          </button>
          <br />
          <small style={{fontFamily: 'monospace', fontWeight: 'bold', color: 'lightgrey'}}>Don't forget your username</small>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container App">
      <header>
        <nav>
          <h1>RexOrion</h1>
          <small>Online {userCount}</small> {/*show user count*/}
        </nav>
      </header>

      {/* TABS BUTTONS */}
      <section className="tabs-container">
        <button className={`world-chat ${activeTab === 'world' ? 'active' : ''}`} onClick={() => setActiveTab('world')}>World</button>
        <button className={`ai-chat ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI</button>
      </section>

      {/* --- AI SECTION --- */}
      {/* We control visibility here using State, not manual DOM manipulation */}
      <section style={{ display: activeTab === 'ai' ? 'block' : 'none' }}>
        <div className="chat-history ai">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender} message-bubble`}>
              <strong>{msg.sender === "user" ? "You" : "AI"}:</strong>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          ))}
          {isLoading && <div className="message bot"><small className="dot"></small><small className="dot"></small><small className="dot"></small></div>}
          {/* Invisible element to auto-scroll to */}
          <div ref={aiChatEndRef} />
        </div>

        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask AI something..."
            className='user-input'
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </section>

      {/* --- WORLD SECTION --- */}
      <section style={{ display: activeTab === 'world' ? 'block' : 'none' }}>
        <div className="chat-history world">
          {worldMessages.map((msg, index) => {
            const isMe = msg.username === username; // is the sender me of someone else?

            return (
            <div key={ index } 
              className='message user message-bubble' 
              style={{ background: isMe ? '#dcf8c6' : '#ffffff', color:'black', alignSelf: isMe ? 'flex-end' : 'flex-start', borderRadius: '10px', textAlign: "left" }}>
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>{ isMe ? "You" : msg.username }</div>
              {msg.message}
            </div>
          );
          })}
          <div ref={worldChatEndRef} />
        </div>

        <div className="input-area">
          <input value={worldInput} 
            onChange={(e) => setWorldInput(e.target.value)}
            onKeyPress={ (e) => e.key === 'Enter' && sendWorldMessage()}
            placeholder="Message the world..."
            className='user-input'
          />
          <button onClick={sendWorldMessage}>Broadcast</button>
        </div>
      </section>

    </div>
  )
}

export default App