# import necessary modules
from sqlalchemy.exc import IntegrityError # Import this to handle "Duplicate" errors
from flask_socketio import SocketIO, emit, join_room, send
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import google.generativeai as genai
from flask_session import Session
from dotenv import load_dotenv
from datetime import datetime
from flask_cors import CORS
from io import BytesIO
import eventlet
import qrcode
import base64
import os
eventlet.monkey_patch()

# Switching from local AI to Google's cloud AI
# 1. load the secret key from .env file
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# 2. configure AI
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash') # A fast, efficient model

chat_session = model.start_chat(history=[]) # Implement context retention for AI (memory)

# configure database URL for production use
database_url = os.environ.get('DATABASE_URL') # get url from env variable
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'mysecretkey'
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///chat.db' # using sqlite database
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'

# configure security key
# CORS(app, resources={r"/*": {"origins": "*"}}) # enable CORS for all origins
CORS(app)
# I removed the async_mode='threading' parameter from below line
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet') # initialize socketio
# configure database with sqlalchemy
db = SQLAlchemy(app) # initialize database

# configure session
Session(app) # initialize session

# configure AI model (Llama)
model_name = 'qwen2:0.5b'  # specify the model name (local model example)

# implementing memory of AI using Global variable for memory
# user_sessions = {}

# count Global Users
connected_users = set()

# create the users table
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True) #unique id
    username = db.Column(db.String(50), unique=True, nullable=False) # can't be empty

# create a database model, to store user data
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True) # unique id
    username = db.Column(db.String(50), nullable=False) # can't be empty
    text = db.Column(db.String(500), nullable=False) # can't be empty
    clock = db.Column(db.String(20), nullable=False) # storing time, not empty

# persistent data for AI
class AIChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(10), nullable=False)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# define a simple route
@app.route('/')
def home():
    return "AI server is Online!!"

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username')

    if not username:
        return jsonify({'error': "Username can't be empty"}), 400
    
    # check if user exists
    existing_user = User.query.filter_by(username=username).first()

    if existing_user:
        # for now just log them in
        print("User exists. \nDatabase check 1")
        return jsonify({'message': 'Welcome back!', 'username': username})
    else:
        try:
            print("User doesn't exists. Creating new user. \nDatabase check 2")
            # user doesn't exist, Create them
            new_user = User(username=username)
            db.session.add(new_user)
            db.session.commit()
            return jsonify({ "message": "User created successfully!", "username": username })
        except IntegrityError:
            # in case two person try at same time
            db.session.rollback()
            return jsonify({ "error": "Username already taken!" }), 409

# chat endpoint
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    username = data.get('username')

    if not username:
        return jsonify({'reply': "Error: I don't know who you are. Please reload.."}), 400
    
    recent_chat = AIChatHistory.query.filter_by(username=username).order_by(AIChatHistory.id.asc()).limit(20).all()

    gemini_history=[]
    for chat in recent_chat:
        gemini_history.append({
            "role": chat.role,
            "parts": [chat.text]
            })
    
    chat_session = model.start_chat(history=gemini_history)

    try:
        response = chat_session.send_message(user_message)
        bot_reply = response.text

        user_entry = AIChatHistory(username=username, role='user', text=user_message)
        ai_entry = AIChatHistory(username=username, role='model', text=bot_reply)

        db.session.add(user_entry)
        db.session.add(ai_entry)
        db.session.commit()

        return jsonify({'reply': bot_reply})
    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({'reply': "My brain is fuzzy right now. Try again later."})

# Make sure you have a folder named 'static' in your root directory!
UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# generate qr code or a file
@app.route('/qrcode_file', methods=['POST'])
def generateQR():
    if 'file' not in request.files:
        return jsonify({ 'error': 'No file part' }), 400
    
    file = request.files['file']

    if file.filename == '':
        return jsonify({ 'error': 'No selected file '}), 400
    
    if file:
        print(f'Received file: {file.filename}')
        
        # first save the uploaded file to get a URL
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        # generate url
        file_url = f"{request.host_url}{UPLOAD_FOLDER}/{file.filename}"

        # create/generate qrcode
        qr = qrcode.make(file_url)

        # save it
        buffer = BytesIO()
        qr.save(buffer, format="PNG")
        buffer.seek(0)

        # convert it into base64 string
        img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return jsonify({ 'message': 'File received successfully!', 'qrcode': f"data:image/png;base64,{img_str}" })

# global chat endpoint
@socketio.on('connect')
def handle_connect():
    global connected_users
    connected_users.add(request.sid)
    print('a user connected to global chat', len(connected_users))

    # load old messages (take 50 for now)
    old_msg = Message.query.all()
    # convert them to a list of dicts
    history = []
    for msg in old_msg:
        history.append({ 'username': msg.username, 'message': msg.text, 'clock': msg.clock })
    
    emit('user_count_update', { 'count': len(connected_users) }, broadcast=True )
    emit('load_history', history)

@socketio.on('disconnect')
def handle_disconnect():
    global connected_users
    if request.sid in connected_users:
        connected_users.remove(request.sid)
    
    print('a user disconnected from global chat', len(connected_users))
    emit('user_count_update', { 'count': len(connected_users) }, broadcast=True )

# listen to messages from clients/react
@socketio.on('send_global_message')
def handle_message(data):
    message = data['message']
    # get the username sent from client
    username = data.get('username', 'Anonymous')
    # get current time
    clock=datetime.now().strftime('%I:%M %p')
    print(f'{username} says: {message} time: {clock}')

    try:
        # save to Database
        # create a row in the sheet
        new_msg = Message(username=username, text=message, clock=clock)
        # add it to stagging area
        db.session.add(new_msg)
        # commit/save changes to the file
        db.session.commit()
        print("Message saved to database.")
    except Exception as e:
        print('Error saving message to database:', e)

    # broadcast = true, means: send to all clients
    response_data = {
        'username': username,
        'message': message,
        'clock': clock
        }
    emit('receive_global_message', response_data, broadcast=True)

# connect users to private chat room
@socketio.on('join')
def on_join(data):
    username = data['username']
    # make the room name as username
    join_room(username)
    print(f'{username} has joined their private room.')

# private chat endpoint
@socketio.on('send_private_message')
def handle_private_message(data):
    message = data['message']
    username = data['username']
    receiver = data['receiver']
    clock=datetime.now().strftime('%I:%M %p')

    # send message to recipient's username
    emit('receive_private_message', {
        'username': username,
        'message': message,
        'clock': clock
    }, room=receiver)
    # also send a copy to sendsr's room for better UX and less confusion
    emit('receive_private_message', {
        'username': username,
        'message': message,
        'clock': clock
    }, room=username)

with app.app_context(): # check if table exists, create if not.
    db.create_all()

# if __name__ == '__main__':
#     socketio.run(app, debug=True, port=5000)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)