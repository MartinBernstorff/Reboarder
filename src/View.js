import { jsx as _jsx } from "react/jsx-runtime";
import { TFolder } from 'obsidian';
import { useApp, usePlugin } from '../hooks';
import { Board } from 'src/components/Board';
export const ReboarderView = ({ selectedBoardPath, onOpenFile }) => {
    const app = useApp();
    const plugin = usePlugin();
    console.log('ReactReboarderView: selectedBoardPath =', selectedBoardPath);
    const handleOpenNote = (file) => {
        if (onOpenFile) {
            const tfile = app.vault.getAbstractFileByPath(file.name);
            onOpenFile(tfile);
        }
        else {
            app.workspace.openLinkText(file.name, '');
        }
    };
    // Don't render if no board path is set
    if (!selectedBoardPath) {
        return (_jsx("div", Object.assign({ className: "reboarder-container" }, { children: _jsx("div", Object.assign({ className: "reboarder-empty" }, { children: "Loading board..." })) })));
    }
    // Always show the specific board
    const folder = app.vault.getAbstractFileByPath(selectedBoardPath);
    if (folder instanceof TFolder) {
        return (_jsx("div", Object.assign({ className: "reboarder-container" }, { children: _jsx("div", Object.assign({ className: "reboarder-boards" }, { children: _jsx(Board, { folder: folder, plugin: plugin, onOpenNote: handleOpenNote }) })) })));
    }
    else {
        return (_jsx("div", Object.assign({ className: "reboarder-container" }, { children: _jsx("div", Object.assign({ className: "reboarder-empty" }, { children: "Board not found." })) })));
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmlldy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlZpZXcudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFDQSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sVUFBVSxDQUFDO0FBQzFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQzdDLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUc3QyxNQUFNLENBQUMsTUFBTSxhQUFhLEdBR3JCLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFO0lBQzFDLE1BQU0sR0FBRyxHQUFHLE1BQU0sRUFBRSxDQUFDO0lBQ3JCLE1BQU0sTUFBTSxHQUFHLFNBQVMsRUFBRSxDQUFDO0lBRTNCLE9BQU8sQ0FBQyxHQUFHLENBQUMseUNBQXlDLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUUxRSxNQUFNLGNBQWMsR0FBRyxDQUFDLElBQWdCLEVBQUUsRUFBRTtRQUMzQyxJQUFJLFVBQVUsRUFBRTtZQUNmLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBVSxDQUFDO1lBQ2xFLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNsQjthQUFNO1lBQ04sR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMxQztJQUNGLENBQUMsQ0FBQztJQUVGLHVDQUF1QztJQUN2QyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7UUFDdkIsT0FBTyxDQUNOLDRCQUFLLFNBQVMsRUFBQyxxQkFBcUIsZ0JBQ25DLDRCQUFLLFNBQVMsRUFBQyxpQkFBaUIsc0NBQXVCLElBQ2xELENBQ04sQ0FBQztLQUNGO0lBRUQsaUNBQWlDO0lBQ2pDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNsRSxJQUFJLE1BQU0sWUFBWSxPQUFPLEVBQUU7UUFDOUIsT0FBTyxDQUNOLDRCQUFLLFNBQVMsRUFBQyxxQkFBcUIsZ0JBQ25DLDRCQUFLLFNBQVMsRUFBQyxrQkFBa0IsZ0JBQ2hDLEtBQUMsS0FBSyxJQUNMLE1BQU0sRUFBRSxNQUFNLEVBQ2QsTUFBTSxFQUFFLE1BQU0sRUFDZCxVQUFVLEVBQUUsY0FBYyxHQUN6QixJQUNHLElBQ0QsQ0FDTixDQUFDO0tBQ0Y7U0FBTTtRQUNOLE9BQU8sQ0FDTiw0QkFBSyxTQUFTLEVBQUMscUJBQXFCLGdCQUNuQyw0QkFBSyxTQUFTLEVBQUMsaUJBQWlCLHNDQUF1QixJQUNsRCxDQUNOLENBQUM7S0FDRjtBQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBURm9sZGVyLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVzZUFwcCwgdXNlUGx1Z2luIH0gZnJvbSAnLi4vaG9va3MnO1xuaW1wb3J0IHsgQm9hcmQgfSBmcm9tICdhcHAvY29tcG9uZW50cy9Cb2FyZCc7XG5pbXBvcnQgeyBGaWxlUmVjb3JkIH0gZnJvbSAnLi9SZWJvYXJkZXJQbHVnaW4nO1xuXG5leHBvcnQgY29uc3QgUmVib2FyZGVyVmlldzogUmVhY3QuRkM8e1xuXHRzZWxlY3RlZEJvYXJkUGF0aDogc3RyaW5nOyAvLyBNdXN0IGFsd2F5cyBiZSBhIHNwZWNpZmljIGJvYXJkXG5cdG9uT3BlbkZpbGU/OiAoZmlsZTogVEZpbGUpID0+IHZvaWQ7XG59PiA9ICh7IHNlbGVjdGVkQm9hcmRQYXRoLCBvbk9wZW5GaWxlIH0pID0+IHtcblx0Y29uc3QgYXBwID0gdXNlQXBwKCk7XG5cdGNvbnN0IHBsdWdpbiA9IHVzZVBsdWdpbigpO1xuXG5cdGNvbnNvbGUubG9nKCdSZWFjdFJlYm9hcmRlclZpZXc6IHNlbGVjdGVkQm9hcmRQYXRoID0nLCBzZWxlY3RlZEJvYXJkUGF0aCk7XG5cblx0Y29uc3QgaGFuZGxlT3Blbk5vdGUgPSAoZmlsZTogRmlsZVJlY29yZCkgPT4ge1xuXHRcdGlmIChvbk9wZW5GaWxlKSB7XG5cdFx0XHRjb25zdCB0ZmlsZSA9IGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZS5uYW1lKSBhcyBURmlsZTtcblx0XHRcdG9uT3BlbkZpbGUodGZpbGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLm5hbWUsICcnKTtcblx0XHR9XG5cdH07XG5cblx0Ly8gRG9uJ3QgcmVuZGVyIGlmIG5vIGJvYXJkIHBhdGggaXMgc2V0XG5cdGlmICghc2VsZWN0ZWRCb2FyZFBhdGgpIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItY29udGFpbmVyXCI+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVib2FyZGVyLWVtcHR5XCI+TG9hZGluZyBib2FyZC4uLjwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fVxuXG5cdC8vIEFsd2F5cyBzaG93IHRoZSBzcGVjaWZpYyBib2FyZFxuXHRjb25zdCBmb2xkZXIgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHNlbGVjdGVkQm9hcmRQYXRoKTtcblx0aWYgKGZvbGRlciBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItY29udGFpbmVyXCI+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVib2FyZGVyLWJvYXJkc1wiPlxuXHRcdFx0XHRcdDxCb2FyZFxuXHRcdFx0XHRcdFx0Zm9sZGVyPXtmb2xkZXJ9XG5cdFx0XHRcdFx0XHRwbHVnaW49e3BsdWdpbn1cblx0XHRcdFx0XHRcdG9uT3Blbk5vdGU9e2hhbmRsZU9wZW5Ob3RlfVxuXHRcdFx0XHRcdC8+XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItY29udGFpbmVyXCI+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVib2FyZGVyLWVtcHR5XCI+Qm9hcmQgbm90IGZvdW5kLjwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fVxufTtcbiJdfQ==
