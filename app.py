import os
import requests
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from functools import wraps
import json
from datetime import datetime

# --- APP INITIALIZATION ---
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-super-secret-key-that-should-be-changed')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////app/nico_ai.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- DATABASE MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False) # In a real app, this should be a hash

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('Message', backref='chat', lazy=True, cascade="all, delete-orphan")
    user = db.relationship('User', backref='chats')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    role = db.Column(db.String(10), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    model_used = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.before_request
def create_tables():
    # This function will run before the first request to the application.
    # It's a simple way to create the database tables without a separate migration tool.
    db.create_all()

# --- AUTHENTICATION & HELPERS ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- AI MODEL CONFIGURATION ---
AI_MODELS = {
    'gpt-5': {'type': 'azure_chat', 'deployment': os.getenv('GPT5_DEPLOYMENT'), 'api_version': '2025-01-01-preview'},
    'o4-mini': {'type': 'azure_chat', 'deployment': os.getenv('O4MINI_DEPLOYMENT'), 'api_version': '2025-01-01-preview'},
    'llama-3': {'type': 'studio_chat', 'model_name': os.getenv('LLAMA3_70B_MODEL')},
    'llama-4': {'type': 'studio_chat', 'model_name': os.getenv('LLAMA4_17B_MODEL')},
    'phi-4': {'type': 'studio_chat', 'model_name': os.getenv('PHI4_MODEL')},
    'grok': {'type': 'grok_chat', 'model_name': os.getenv('GROK_MODEL')},
    'dall-e-3': {'type': 'dall_e_3'},
    'sora': {'type': 'sora'},
    'tts': {'type': 'tts'},
}

def make_api_request(model_key, payload):
    model_config = AI_MODELS.get(model_key, {})
    model_type = model_config.get('type')

    headers = {"Content-Type": "application/json"}
    endpoint = ""

    if model_type in ['azure_chat', 'dall_e_3', 'tts']:
        endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        headers['Authorization'] = f"Bearer {os.getenv('AZURE_OPENAI_API_KEY')}"
        if model_type == 'azure_chat':
            endpoint += f"openai/deployments/{model_config['deployment']}/chat/completions?api-version={model_config['api_version']}"
        elif model_type == 'dall_e_3':
             endpoint += 'openai/images/generations:submit?api-version=2024-02-15-preview'
        elif model_type == 'tts':
            endpoint += 'openai/deployments/tts-1/audio/speech?api-version=2024-05-01-preview'

    elif model_type == 'studio_chat':
        endpoint = os.getenv('AZURE_AI_STUDIO_ENDPOINT') + '/chat/completions?api-version=2024-05-01-preview'
        headers['Authorization'] = f"Bearer {os.getenv('AZURE_AI_STUDIO_API_KEY')}"
        payload['model'] = model_config['model_name']

    elif model_type == 'grok_chat':
        endpoint = 'https://api.x.ai/v1/chat/completions'
        headers['Authorization'] = f"Bearer {os.getenv('GROK_API_KEY')}"
        payload['model'] = model_config['model_name']

    elif model_type == 'sora':
        endpoint = os.getenv('AZURE_OPENAI_ENDPOINT') + f"openai/deployments/{os.getenv('SORA_DEPLOYMENT')}/video/generations/jobs?api-version=preview"
        headers['api-key'] = os.getenv('AZURE_OPENAI_API_KEY') # Sora uses api-key header

    else:
        raise ValueError("Invalid model type specified")

    response = requests.post(endpoint, headers=headers, json=payload)
    response.raise_for_status()
    return response

# --- WEB PAGE ROUTES ---
@app.route('/')
def index():
    if 'user_id' in session:
        return render_template('index.html', user=User.query.get(session['user_id']))
    return render_template('index.html', user=None)

# --- AUTHENTICATION API ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    # In a real app, hash the password: generate_password_hash(password)
    new_user = User(username=username, password=password)
    db.session.add(new_user)
    db.session.commit()
    session['user_id'] = new_user.id
    return jsonify({'message': 'Registration successful', 'username': new_user.username})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()

    # In a real app, check the hash: check_password_hash(user.password, password)
    if user and user.password == password:
        session['user_id'] = user.id
        return jsonify({'message': 'Login successful', 'username': user.username})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logout successful'})

# --- CORE API ROUTES ---
@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    user = User.query.get(session['user_id'])
    chats = [{'id': chat.id, 'title': chat.title} for chat in user.chats]
    return jsonify(chats)

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_messages(chat_id):
    chat = Chat.query.get(chat_id)
    if not chat or chat.user_id != session['user_id']:
        return jsonify({'error': 'Chat not found'}), 404
    messages = [{'role': msg.role, 'content': msg.content} for msg in chat.messages]
    return jsonify(messages)

@app.route('/api/chat', methods=['POST'])
@login_required
def chat_endpoint():
    data = request.json
    prompt = data.get('prompt')
    model_key = data.get('model', 'gpt-5')
    chat_id = data.get('chat_id')

    # Get or create chat
    if chat_id:
        chat_obj = Chat.query.get(chat_id)
        if not chat_obj or chat_obj.user_id != session['user_id']:
            return jsonify({'error': 'Chat not found'}), 404
    else:
        title = prompt[:50] if len(prompt) > 50 else prompt
        chat_obj = Chat(user_id=session['user_id'], title=title)
        db.session.add(chat_obj)
        db.session.commit()

    # Save user message
    user_msg = Message(chat_id=chat_obj.id, role='user', content=prompt)
    db.session.add(user_msg)

    # Prepare payload for AI
    history = Message.query.filter_by(chat_id=chat_obj.id).order_by(Message.created_at.asc()).all()
    messages_payload = [{"role": msg.role, "content": msg.content} for msg in history]

    payload = {"messages": messages_payload, "max_tokens": 2048}

    try:
        response = make_api_request(model_key, payload)
        api_response = response.json()
        ai_content = api_response['choices'][0]['message']['content']

        # Save assistant message
        assistant_msg = Message(chat_id=chat_obj.id, role='assistant', content=ai_content, model_used=model_key)
        db.session.add(assistant_msg)
        db.session.commit()

        return jsonify({
            'response': ai_content,
            'chat_id': chat_obj.id,
            'new_chat_title': chat_obj.title if not chat_id else None
        })
    except Exception as e:
        return jsonify({'error': f'API request failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)
