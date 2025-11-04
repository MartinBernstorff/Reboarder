import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer, Component } from 'obsidian';
import { CustomSnoozeModal } from './CustomSnoozeModal';
import { useApp } from 'hooks';
export const Card = ({ file, plugin, onUnpin, onOpen, onDelete }) => {
    const app = useApp();
    const [showCustomSnooze, setShowCustomSnooze] = useState(false);
    const previewRef = useRef(null);
    useEffect(() => {
        let component = null;
        const renderMarkdownPreview = (file) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const content = yield app.vault.read(file);
                // Truncate content to the specified length for preview
                const maxLength = plugin.settings.cardPreviewLength;
                let truncatedContent = content;
                const truncationSymbol = ' [...]';
                if (content.length > maxLength) {
                    // Find the last newline before the character limit
                    let truncateAt = maxLength;
                    while (truncateAt > 0 && content[truncateAt] !== '\n') {
                        truncateAt--;
                    }
                    // If we found a newline, truncate there; otherwise fall back to character limit
                    if (truncateAt > 0) {
                        truncatedContent = content.substring(0, truncateAt).trim() + truncationSymbol;
                    }
                    else {
                        truncatedContent = content.substring(0, maxLength) + truncationSymbol;
                    }
                }
                // Create a temporary container for rendering
                if (previewRef.current) {
                    previewRef.current.empty();
                    // Create a temporary component for the markdown rendering
                    component = new Component();
                    // Render the markdown content
                    yield MarkdownRenderer.renderMarkdown(truncatedContent, previewRef.current, file.path, component);
                }
            }
            catch (error) {
                if (previewRef.current) {
                    previewRef.current.textContent = 'Error reading file content';
                }
            }
        });
        const tfile = app.vault.getAbstractFileByPath(file.path);
        renderMarkdownPreview(tfile);
        // Cleanup function
        return () => {
            if (component) {
                component.unload();
            }
        };
    }, [file, app.vault, plugin.settings.cardPreviewLength]);
    const handleSnoozeClick = (e) => {
        e.stopPropagation();
        setShowCustomSnooze(true);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", Object.assign({ className: "reboarder-card", onClick: onOpen }, { children: [_jsx("div", Object.assign({ className: "reboarder-card-header" }, { children: _jsx("h4", { children: file.name.replace(".md", "") }) })), _jsx("div", Object.assign({ className: "reboarder-card-content" }, { children: _jsx("div", { ref: previewRef, className: "markdown-preview-view" }) })), _jsxs("div", Object.assign({ className: "reboarder-card-actions" }, { children: [_jsx("button", Object.assign({ onClick: (e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }, className: "reboarder-btn reboarder-btn-delete" }, { children: "Delete" })), _jsx("button", Object.assign({ onClick: (e) => {
                                    e.stopPropagation();
                                    onUnpin();
                                }, className: "reboarder-btn reboarder-btn-unpin" }, { children: "Unpin" })), _jsx("button", Object.assign({ onClick: handleSnoozeClick, className: "reboarder-btn", title: "Set a custom snooze duration (in days)" }, { children: "Snooze" }))] }))] })), _jsx(CustomSnoozeModal, { file: file, isOpen: showCustomSnooze, onClose: () => setShowCustomSnooze(false), onComplete: () => console.log("Completed") })] }));
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2FyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkNhcmQudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBYyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBQzNELE9BQU8sRUFBUyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFeEQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLE9BQU8sQ0FBQztBQVUvQixNQUFNLENBQUMsTUFBTSxJQUFJLEdBQXdCLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtJQUN4RixNQUFNLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQztJQUNyQixNQUFNLENBQUMsZ0JBQWdCLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFpQixJQUFJLENBQUMsQ0FBQztJQUVoRCxTQUFTLENBQUMsR0FBRyxFQUFFO1FBQ2QsSUFBSSxTQUFTLEdBQXFCLElBQUksQ0FBQztRQUV2QyxNQUFNLHFCQUFxQixHQUFHLENBQU8sSUFBVyxFQUFpQixFQUFFO1lBQ2xFLElBQUk7Z0JBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFM0MsdURBQXVEO2dCQUN2RCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDO2dCQUNwRCxJQUFJLGdCQUFnQixHQUFHLE9BQU8sQ0FBQztnQkFFL0IsTUFBTSxnQkFBZ0IsR0FBRyxRQUFRLENBQUM7Z0JBRWxDLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxT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RUFDMUIsU0FBUyxFQUFDLGVBQWUsRUFDekIsS0FBSyxFQUFDLHdDQUF3Qyw0QkFHdEMsS0FDSixLQUNELEVBRU4sS0FBQyxpQkFBaUIsSUFDakIsSUFBSSxFQUFFLElBQUksRUFDVixNQUFNLEVBQUUsZ0JBQWdCLEVBQ3hCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFDekMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQ3pDLElBQ0EsQ0FDSCxDQUFDO0FBQ0gsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZVJlZiB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IFRGaWxlLCBNYXJrZG93blJlbmRlcmVyLCBDb21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBDdXN0b21Tbm9vemVNb2RhbCB9IGZyb20gJy4vQ3VzdG9tU25vb3plTW9kYWwnO1xuaW1wb3J0IFJlYm9hcmRlclBsdWdpbiwgeyBGaWxlUmVjb3JkIH0gZnJvbSAnYXBwL1JlYm9hcmRlclBsdWdpbic7XG5pbXBvcnQgeyB1c2VBcHAgfSBmcm9tICdob29rcyc7XG5cbmludGVyZmFjZSBDYXJkUHJvcHMge1xuXHRmaWxlOiBGaWxlUmVjb3JkO1xuXHRwbHVnaW46IFJlYm9hcmRlclBsdWdpbjtcblx0b25VbnBpbjogKCkgPT4gdm9pZDtcblx0b25PcGVuOiAoKSA9PiB2b2lkO1xuXHRvbkRlbGV0ZTogKCkgPT4gdm9pZDsgLy8gT3B0aW9uYWwgZGVsZXRlIGhhbmRsZXJcbn1cblxuZXhwb3J0IGNvbnN0IENhcmQ6IFJlYWN0LkZDPENhcmRQcm9wcz4gPSAoeyBmaWxlLCBwbHVnaW4sIG9uVW5waW4sIG9uT3Blbiwgb25EZWxldGUgfSkgPT4ge1xuXHRjb25zdCBhcHAgPSB1c2VBcHAoKTtcblx0Y29uc3QgW3Nob3dDdXN0b21Tbm9vemUsIHNldFNob3dDdXN0b21Tbm9vemVdID0gdXNlU3RhdGUoZmFsc2UpO1xuXHRjb25zdCBwcmV2aWV3UmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50PihudWxsKTtcblxuXHR1c2VFZmZlY3QoKCkgPT4ge1xuXHRcdGxldCBjb21wb25lbnQ6IENvbXBvbmVudCB8IG51bGwgPSBudWxsO1xuXG5cdFx0Y29uc3QgcmVuZGVyTWFya2Rvd25QcmV2aWV3ID0gYXN5bmMgKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cblx0XHRcdFx0Ly8gVHJ1bmNhdGUgY29udGVudCB0byB0aGUgc3BlY2lmaWVkIGxlbmd0aCBmb3IgcHJldmlld1xuXHRcdFx0XHRjb25zdCBtYXhMZW5ndGggPSBwbHVnaW4uc2V0dGluZ3MuY2FyZFByZXZpZXdMZW5ndGg7XG5cdFx0XHRcdGxldCB0cnVuY2F0ZWRDb250ZW50ID0gY29udGVudDtcblxuXHRcdFx0XHRjb25zdCB0cnVuY2F0aW9uU3ltYm9sID0gJyBbLi4uXSc7XG5cblx0XHRcdFx0aWYgKGNvbnRlbnQubGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gRmluZCB0aGUgbGFzdCBuZXdsaW5lIGJlZm9yZSB0aGUgY2hhcmFjdGVyIGxpbWl0XG5cdFx0XHRcdFx0bGV0IHRydW5jYXRlQXQgPSBtYXhMZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKHRydW5jYXRlQXQgPiAwICYmIGNvbnRlbnRbdHJ1bmNhdGVBdF0gIT09ICdcXG4nKSB7XG5cdFx0XHRcdFx0XHR0cnVuY2F0ZUF0LS07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gSWYgd2UgZm91bmQgYSBuZXdsaW5lLCB0cnVuY2F0ZSB0aGVyZTsgb3RoZXJ3aXNlIGZhbGwgYmFjayB0byBjaGFyYWN0ZXIgbGltaXRcblx0XHRcdFx0XHRpZiAodHJ1bmNhdGVBdCA+IDApIHtcblx0XHRcdFx0XHRcdHRydW5jYXRlZENvbnRlbnQgPSBjb250ZW50LnN1YnN0cmluZygwLCB0cnVuY2F0ZUF0KS50cmltKCkgKyB0cnVuY2F0aW9uU3ltYm9sO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0cnVuY2F0ZWRDb250ZW50ID0gY29udGVudC5zdWJzdHJpbmcoMCwgbWF4TGVuZ3RoKSArIHRydW5jYXRpb25TeW1ib2w7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ3JlYXRlIGEgdGVtcG9yYXJ5IGNvbnRhaW5lciBmb3IgcmVuZGVyaW5nXG5cdFx0XHRcdGlmIChwcmV2aWV3UmVmLmN1cnJlbnQpIHtcblx0XHRcdFx0XHRwcmV2aWV3UmVmLmN1cnJlbnQuZW1wdHkoKTtcblxuXHRcdFx0XHRcdC8vIENyZWF0ZSBhIHRlbXBvcmFyeSBjb21wb25lbnQgZm9yIHRoZSBtYXJrZG93biByZW5kZXJpbmdcblx0XHRcdFx0XHRjb21wb25lbnQgPSBuZXcgQ29tcG9uZW50KCk7XG5cblx0XHRcdFx0XHQvLyBSZW5kZXIgdGhlIG1hcmtkb3duIGNvbnRlbnRcblx0XHRcdFx0XHRhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKFxuXHRcdFx0XHRcdFx0dHJ1bmNhdGVkQ29udGVudCxcblx0XHRcdFx0XHRcdHByZXZpZXdSZWYuY3VycmVudCxcblx0XHRcdFx0XHRcdGZpbGUucGF0aCxcblx0XHRcdFx0XHRcdGNvbXBvbmVudFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmIChwcmV2aWV3UmVmLmN1cnJlbnQpIHtcblx0XHRcdFx0XHRwcmV2aWV3UmVmLmN1cnJlbnQudGV4dENvbnRlbnQgPSAnRXJyb3IgcmVhZGluZyBmaWxlIGNvbnRlbnQnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRmaWxlID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlLnBhdGgpISBhcyBURmlsZTtcblx0XHRyZW5kZXJNYXJrZG93blByZXZpZXcodGZpbGUpO1xuXG5cdFx0Ly8gQ2xlYW51cCBmdW5jdGlvblxuXHRcdHJldHVybiAoKSA9PiB7XG5cdFx0XHRpZiAoY29tcG9uZW50KSB7XG5cdFx0XHRcdGNvbXBvbmVudC51bmxvYWQoKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9LCBbZmlsZSwgYXBwLnZhdWx0LCBwbHVnaW4uc2V0dGluZ3MuY2FyZFByZXZpZXdMZW5ndGhdKTtcblxuXHRjb25zdCBoYW5kbGVTbm9vemVDbGljayA9IChlOiBSZWFjdC5Nb3VzZUV2ZW50KSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRzZXRTaG93Q3VzdG9tU25vb3plKHRydWUpO1xuXHR9O1xuXG5cdHJldHVybiAoXG5cdFx0PD5cblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVib2FyZGVyLWNhcmRcIiBvbkNsaWNrPXtvbk9wZW59PlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInJlYm9hcmRlci1jYXJkLWhlYWRlclwiPlxuXHRcdFx0XHRcdDxoND57ZmlsZS5uYW1lLnJlcGxhY2UoXCIubWRcIiwgXCJcIil9PC9oND5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVib2FyZGVyLWNhcmQtY29udGVudFwiPlxuXHRcdFx0XHRcdDxkaXYgcmVmPXtwcmV2aWV3UmVmfSBjbGFzc05hbWU9XCJtYXJrZG93bi1wcmV2aWV3LXZpZXdcIiAvPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItY2FyZC1hY3Rpb25zXCI+XG5cdFx0XHRcdFx0PGJ1dHRvblxuXHRcdFx0XHRcdFx0b25DbGljaz17KGUpID0+IHtcblx0XHRcdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHRcdFx0b25EZWxldGUoKTtcblx0XHRcdFx0XHRcdH19XG5cdFx0XHRcdFx0XHRjbGFzc05hbWU9XCJyZWJvYXJkZXItYnRuIHJlYm9hcmRlci1idG4tZGVsZXRlXCJcblx0XHRcdFx0XHQ+XG5cdFx0XHRcdFx0XHREZWxldGVcblx0XHRcdFx0XHQ8L2J1dHRvbj5cblx0XHRcdFx0XHQ8YnV0dG9uXG5cdFx0XHRcdFx0XHRvbkNsaWNrPXsoZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRvblVucGluKCk7XG5cdFx0XHRcdFx0XHR9fVxuXHRcdFx0XHRcdFx0Y2xhc3NOYW1lPVwicmVib2FyZGVyLWJ0biByZWJvYXJkZXItYnRuLXVucGluXCJcblx0XHRcdFx0XHQ+XG5cdFx0XHRcdFx0XHRVbnBpblxuXHRcdFx0XHRcdDwvYnV0dG9uPlxuXHRcdFx0XHRcdDxidXR0b25cblx0XHRcdFx0XHRcdG9uQ2xpY2s9e2hhbmRsZVNub296ZUNsaWNrfVxuXHRcdFx0XHRcdFx0Y2xhc3NOYW1lPVwicmVib2FyZGVyLWJ0blwiXG5cdFx0XHRcdFx0XHR0aXRsZT1cIlNldCBhIGN1c3RvbSBzbm9vemUgZHVyYXRpb24gKGluIGRheXMpXCJcblx0XHRcdFx0XHQ+XG5cdFx0XHRcdFx0XHRTbm9vemVcblx0XHRcdFx0XHQ8L2J1dHRvbj5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQ8L2Rpdj5cblxuXHRcdFx0PEN1c3RvbVNub296ZU1vZGFsXG5cdFx0XHRcdGZpbGU9e2ZpbGV9XG5cdFx0XHRcdGlzT3Blbj17c2hvd0N1c3RvbVNub296ZX1cblx0XHRcdFx0b25DbG9zZT17KCkgPT4gc2V0U2hvd0N1c3RvbVNub296ZShmYWxzZSl9XG5cdFx0XHRcdG9uQ29tcGxldGU9eygpID0+IGNvbnNvbGUubG9nKFwiQ29tcGxldGVkXCIpfVxuXHRcdFx0Lz5cblx0XHQ8Lz5cblx0KTtcbn07XG4iXX0=