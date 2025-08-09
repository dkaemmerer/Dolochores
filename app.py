import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import date, timedelta
from sqlalchemy import case
import click

# Initialize Flask app
app = Flask(__name__)

# Configure database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'instance', 'chore_app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# --- Models ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    chores = db.relationship('Chore', backref='assignee', lazy=True)

    def __repr__(self):
        return f'<User {self.name}>'

class Chore(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(50))
    frequency = db.Column(db.Integer, nullable=False)  # in days
    last_completed = db.Column(db.Date, default=date.today)
    is_priority = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    previous_last_completed = db.Column(db.Date)

    @property
    def next_due(self):
        if self.last_completed and self.frequency:
            return self.last_completed + timedelta(days=self.frequency)
        return None

    @property
    def status(self):
        today = date.today()
        next_due_date = self.next_due
        if not next_due_date:
            return "N/A"

        if next_due_date < today:
            return "Overdue"

        if self.frequency > 30:
            if today <= next_due_date <= today + timedelta(days=30):
                return "Due Soon"
        else:
            if today <= next_due_date <= today + timedelta(days=14):
                return "Due Soon"

        return "Completed Recently"

    def __repr__(self):
        return f'<Chore {self.title}>'

# --- View Routes ---

@app.route('/')
def all_chores():
    # This is a bit complex. The goal is to sort by status string.
    # A CASE statement is the most efficient way to do this in the database.
    status_order = case(
        {"Overdue": 1, "Due Soon": 2, "Completed Recently": 3},
        value=Chore.status,
        else_=4
    )
    # The above is not directly supported by SQLAlchemy's ORM property.
    # A hybrid property might work, but for now, let's sort in Python.
    chores = Chore.query.all()

    # Custom sort key for status
    status_map = {"Overdue": 1, "Due Soon": 2, "Completed Recently": 3}
    chores.sort(key=lambda c: (status_map.get(c.status, 4), not c.is_priority, c.next_due, -c.frequency))

    return render_template('index.html', chores=chores, users=User.query.all(), title="All Chores")

@app.route('/my-chores/<username>')
def my_chores(username):
    user = User.query.filter_by(name=username).first_or_404()
    chores = sorted(user.chores, key=lambda c: c.next_due)
    return render_template('my_chores.html', chores=chores, username=username, title=f"{username}'s Chores")

@app.route('/priorities')
def priorities():
    priority_chores = Chore.query.filter_by(is_priority=True).all()
    # Sort in Python using the 'next_due' property, handling potential None values
    chores = sorted(priority_chores, key=lambda c: c.next_due if c.next_due else date.max)
    return render_template('priorities.html', chores=chores, title="Priority Chores")

# --- API Routes ---

@app.route('/api/chores', methods=['POST'])
def add_chore():
    data = request.get_json()
    if not data or not all(k in data for k in ['title', 'user_id', 'frequency', 'last_completed']):
        return jsonify({'message': 'Missing required fields'}), 400

    try:
        new_chore = Chore(
            title=data['title'],
            user_id=data['user_id'],
            category=data.get('category'),
            frequency=int(data['frequency']),
            last_completed=date.fromisoformat(data['last_completed']),
            notes=data.get('notes')
        )
        db.session.add(new_chore)
        db.session.commit()
        return jsonify({'message': 'Chore created successfully'}), 201
    except (ValueError, TypeError) as e:
        return jsonify({'message': f'Invalid data: {e}'}), 400


@app.route('/api/chores/<int:chore_id>/complete', methods=['POST'])
def complete_chore(chore_id):
    chore = Chore.query.get_or_404(chore_id)
    chore.previous_last_completed = chore.last_completed
    chore.last_completed = date.today()
    chore.is_priority = False
    db.session.commit()
    return jsonify({'message': 'Chore marked as complete'})

@app.route('/api/chores/<int:chore_id>/toggle-priority', methods=['POST'])
def toggle_priority(chore_id):
    chore = Chore.query.get_or_404(chore_id)
    chore.is_priority = not chore.is_priority
    db.session.commit()
    return jsonify({'is_priority': chore.is_priority})

@app.route('/api/chores/<int:chore_id>/undo', methods=['POST'])
def undo_complete(chore_id):
    chore = Chore.query.get_or_404(chore_id)
    if chore.previous_last_completed:
        chore.last_completed = chore.previous_last_completed
        db.session.commit()
        return jsonify({'message': 'Undo successful'})
    return jsonify({'message': 'No previous date to restore'}), 400

@app.route('/api/chores/<int:chore_id>', methods=['DELETE'])
def delete_chore(chore_id):
    chore = Chore.query.get_or_404(chore_id)
    db.session.delete(chore)
    db.session.commit()
    return jsonify({'message': 'Chore deleted'})

@app.route('/api/chores/<int:chore_id>', methods=['PUT'])
def edit_chore(chore_id):
    chore = Chore.query.get_or_404(chore_id)
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    try:
        chore.title = data.get('title', chore.title)
        chore.user_id = data.get('user_id', chore.user_id)
        chore.category = data.get('category', chore.category)
        chore.frequency = int(data.get('frequency', chore.frequency))
        if 'last_completed' in data:
            chore.last_completed = date.fromisoformat(data['last_completed'])
        chore.notes = data.get('notes', chore.notes)
        chore.is_priority = data.get('is_priority', chore.is_priority)
        db.session.commit()
        return jsonify({'message': 'Chore updated successfully'})
    except (ValueError, TypeError) as e:
        return jsonify({'message': f'Invalid data: {e}'}), 400


import csv
from datetime import datetime

# --- DB Initialization and Reset Commands ---
@app.cli.command('load-chores')
@click.argument('filepath', default='chores.csv')
def load_chores_command(filepath):
    """Loads chores from a CSV file."""
    with app.app_context():
        # Ensure 'Dan + Kim' user exists
        if not User.query.filter_by(name='Dan + Kim').first():
            db.session.add(User(name='Dan + Kim'))
            db.session.commit()

        user_map = {user.name: user.id for user in User.query.all()}

        with open(filepath, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile, delimiter='\t')
            for row in reader:
                try:
                    # Look up user_id, default to first user if not found
                    assignee_name = row['assignee']
                    user_id = user_map.get(assignee_name)
                    if not user_id:
                        print(f"Warning: Assignee '{assignee_name}' not found. Skipping row.")
                        continue

                    # Parse date
                    last_completed_str = row['lastCompleted']
                    last_completed_date = datetime.strptime(last_completed_str, '%b %d, %Y').date()

                    # Parse boolean
                    is_priority = row['isPriority'].upper() == 'TRUE'

                    chore = Chore(
                        title=row['title'],
                        user_id=user_id,
                        category=row['category'],
                        frequency=int(row['frequency']),
                        last_completed=last_completed_date,
                        is_priority=is_priority,
                        notes=row['notes']
                    )
                    db.session.add(chore)
                except (ValueError, KeyError) as e:
                    print(f"Error processing row: {row}. Error: {e}. Skipping.")

            db.session.commit()
    print('Chores have been loaded from CSV.')


@app.cli.command('reset-db')
def reset_db_command():
    """Drops and recreates the database tables."""
    with app.app_context():
        db.drop_all()
        db.create_all()
        # Seed initial users
        if not User.query.filter_by(name='Dan').first():
            db.session.add(User(name='Dan'))
        if not User.query.filter_by(name='Kim').first():
            db.session.add(User(name='Kim'))
        if not User.query.filter_by(name='Katie').first():
            db.session.add(User(name='Katie'))
        db.session.commit()
    print('Database has been reset.')

@app.cli.command('init-db')
def init_db_command():
    """Creates the database tables and seeds initial data."""
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(name='Dan').first():
            db.session.add(User(name='Dan'))
        if not User.query.filter_by(name='Kim').first():
            db.session.add(User(name='Kim'))
        if not User.query.filter_by(name='Katie').first():
            db.session.add(User(name='Katie'))
        db.session.commit()
    print('Initialized the database.')

if __name__ == '__main__':
    app.run(debug=True)
