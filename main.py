# main.py
from flask import Flask, render_template, request, jsonify
import os
import shutil
import stat
import fnmatch
from git import Repo

app = Flask(__name__)

repo_dirs = {
    "repo1": "temp_repos/repo1",
    "repo2": "temp_repos/repo2"
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/compare")
def compare():
    return render_template("compare.html")

@app.route("/value_usage")
def value_usage():
    return render_template("value_usage.html")

@app.route("/clone", methods=["POST"])
def clone_repo():
    data = request.json
    repo_url = data.get("repo_url")
    repo_id = data.get("repo_id")

    if not repo_url:
        return "repo_url not provided", 400

    if not repo_id:
        return "repo_id not provided", 400

    repo_dir = repo_dirs.get(repo_id)

    if os.path.exists(repo_dir):
        def on_rm_error(func, path, exc_info):
            os.chmod(path, stat.S_IWRITE)
            func(path)

        shutil.rmtree(repo_dir, onerror=on_rm_error)

    Repo.clone_from(repo_url, repo_dir)

    repo = Repo(repo_dir)
    branches = []

    # Ophalen van remote branches en filteren van lokale branches en HEAD
    for remote_branch in repo.remotes.origin.refs:
        branch_name = str(remote_branch).replace("origin/", "")
        if branch_name not in branches and branch_name != 'HEAD':
            branches.append(branch_name)

    return jsonify({"branches": branches, "repo_id": repo_id})

@app.route('/switch_branch', methods=['POST'])
def switch_branch():
    data = request.json
    repo_id = data['repo_id']
    branch = data['branch']
    repo_dir = f'temp_repos/{repo_id}'
    repo = Repo(repo_dir)
    repo.git.checkout(branch)
    return jsonify({'success': True})

@app.route('/get_files', methods=['GET'])
def get_files():
    repo_id = request.args.get('repo_id')
    repo_dir = repo_dirs.get(repo_id)
    file_list = []
    for root, _, filenames in os.walk(repo_dir):
        for filename in filenames:
            if not filename.startswith(".") and (filename.endswith(".yaml") or filename.endswith(".yml")):
                relative_path = os.path.relpath(os.path.join(root, filename), repo_dir)
                file_list.append(relative_path)

    return jsonify({"files": file_list})

@app.route('/get_file_content', methods=['GET'])
def get_file_content():
    repo_id = request.args.get('repo_id')
    file_path = request.args.get('file_path')
    repo_dir = repo_dirs.get(repo_id)

    if not repo_dir or not file_path:
        return "Invalid request", 400

    with open(os.path.join(repo_dir, file_path), 'r') as f:
        content = f.read()

    return content

if __name__ == '__main__':
    app.run(debug=True)
