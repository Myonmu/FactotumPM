# Factotum : Project Management for Polymaths

Factotum is a project management app that aims to reduce the risk of burn-outs for polymaths. It is ideal for pet projects that are not limited by time but rather limited by stamina. 

## Getting started

1. Upon launching Factotum, you will be greeted with a sign-in page. Create a database file with the sign-in page, you can place it wherever you want, or use the default one. Your data will be stored locally and securely in this database.
2. Go to the left panel, and select the **Projects** tab. Create a new project by clicking on the plus button. A project is where tasks reside. You can switch project by clicking Open Project, or use the top-right project dropdown.
3. Go to the left panel and select the **Statuses** tab. This is where you define the lifecycle of tasks. Click Add Status to add a new node, and use right mouse button drag and drop to create directed edge between statuses. These edges are transitions, and will be shown as **actions** in task inspector. Make sure to have at least one *Terminal Status* so that the system knows when a task is terminated.
4. Go to the **Domains** tab and click the top-right Graph button. You can create your skill sets here. Right mouse button drag and drop allows you to make a domain a sub-domain.
5. Go to the **Kanban** tab. You should see columns matching the task statuses you created in the Statuses tab. Click on the **+** icon on top of a column and you should see a card created! Click on it and you can edit the details of the task. Click on the trophy icon turns the task into a trophy. Trophy task will show up in **Trophy** tab. 
6. You can go to the **Calendar** tab to plan sessions. 

Quick Recap: in Factotum, we use the following concepts:

- **Task**: Something you want to do. They may have sub-tasks, or have dependency on other tasks.
- **Trophy**: A task that marks a milestone in the project.
- **Domain**: A specific skill set required to perform some tasks. Usually, a task belongs to a domain. Domains may also have sub-domains.
- **Project**: The ultimate goal. Tasks reside in a project.
- **Session**: A period of time you spend on one or multiple tasks.
- **Aftermath**: How do you rate a session.

## Local AI
The **Factotum Agent** can suggest tasks and query your database. But to make use of it, you need to setup a local LLM. 

1. Download and Install **LM Studio**
2. In LM Studio, find Model Search tab and download **Gemma 4 12B** (Or any other model. But after some testing the suggested model provides good quality and reasonable speed.)
3. In LM Studio, find Developer tab and toggle the Status button so it shows *Status: Running*. Click Load Model button to load your downloaded LLM. Increase the context if needed. (Larger context prevents response truncation, sometimes complex request needs longer context).
4. In Factotum's **Dashboard** page, click the **Agent** tab. Click the **LLM Settings** button, select LM Studio as provider, and then pick the model you just loaded. Perform a test to check the connection (optional) then save.
5. Now you can pick a prompt and then write your request. If you don't have any idea, just type in "Pick something" is fine.
6. Wait until the agent runs and produces results.
