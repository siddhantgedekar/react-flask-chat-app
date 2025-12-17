import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import io from 'socket.io-client'
import './App.css'

// connect to server OUTSIDE of the component so it doesn't reconnect, everytime you type
const socket = io('https://sids-worldchat.onrender.com') // adjust URL as needed

function App() {
  const [userCount, setUserCount] = useState(0);
  const [username, setUsername] = useState("User_" + Math.floor(Math.random() * 1000));
  
  const [input, setInput] = useState("");
  const [worldInput, setWorldInput] = useState(""); // separate input for world

  const [messages, setMessages] = useState([]); // AI chat messages
  const [worldMessages, setWorldMessages] = useState([]); // World chat messages

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');

  // Refs are ONLY for scrolling now, not for hiding/showing
  const aiChatEndRef = useRef(null);
  const worldChatEndRef = useRef(null);

  // socket listener (the ear)
  useEffect(() => {
    socket.on('receive_message_from_server', (data) => {
      setWorldMessages((prev) => [...prev, { message: data.message, sender: data.sender }]);
    });
    socket.on('update_user_count', (data) => {
      setUserCount(data.count)
    });
    // cleanup on unmount
    return () => {
      socket.off('receive_message_from_server');
      socket.off('update_user_count');
    };
  }, []);

  const sendMessage = async () => {
    const userInput = input;
    setInput("");
    if (!userInput.trim()) return;

    // Add USER message
    setMessages(prev => [...prev, { sender: "user", text: userInput }]);
    setIsLoading(true);

    try {
      const response = await fetch("https://sids-worldchat.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
      });

      const data = await response.json();

      // Add AI message
      setMessages(prev => [...prev, { sender: "bot", text: data.reply }]);

    } catch (error) {
      console.error("Error:", error);
      // FIX: Hardcoded error message instead of accessing undefined 'data'
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Error: Could not connect to server." }]);
    }

    setIsLoading(false);
  };

  const sendWorldMessage = () => {
    if (!worldInput.trim()) return;

    // send message to python/server via socket
    socket.emit('send_message_to_server', { message: worldInput, username: username });

    // clear the input box of world chat
    setWorldInput("");
  }

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (activeTab === 'ai' && aiChatEndRef.current) aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'world' && worldChatEndRef.current) worldChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, worldMessages, activeTab]);

  return (
    <div className="chat-container">
      <header>
        <nav>
          <h1>Developer Sid</h1>
          <small>Online {userCount}</small>
          <small>
            <input className='username' value={username} onChange={(e) => setUsername(e.target.value)} />
          </small>
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
            // is the sender me of someone else?
            const isMe = msg.sender === username;

            return (
            <div key={ index } 
              className='message user message-bubble' 
              style={{ background: isMe ? '#dcf8c6' : '#ffffff', color:'black', alignSelf: isMe ? 'flex-end' : 'flex-start', borderRadius: '10px', textAlign: "left" }}>
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>{ isMe ? "You" : msg.sender }</div>
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