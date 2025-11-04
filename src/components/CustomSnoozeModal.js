import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { usePlugin } from 'hooks';
export const CustomSnoozeModal = ({ file, isOpen, onClose, onComplete }) => {
    const plugin = usePlugin();
    const inputRef = useRef(null);
    // Store days but initialize from default hours (convert hours -> days, rounding up)
    const defaultDays = Math.max(1, Math.ceil(plugin.settings.defaultSnoozeHours / 24));
    const [days, setDays] = useState(defaultDays);
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.select();
        }
    }, [isOpen]);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen)
                return;
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSnooze();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                setDays(defaultDays); // Reset to default on cancel
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, days]);
    const handleSnooze = () => __awaiter(void 0, void 0, void 0, function* () {
        const hours = days * 24; // convert days to hours
        yield plugin.snoozeNote(file, hours);
        onComplete();
        onClose();
    });
    if (!isOpen)
        return null;
    return (_jsx("div", Object.assign({ className: "reboarder-modal-backdrop" }, { children: _jsxs("div", Object.assign({ className: "reboarder-modal" }, { children: [_jsx("h2", { children: "Custom Snooze" }), _jsx("div", Object.assign({ className: "reboarder-modal-content" }, { children: _jsxs("label", { children: ["Days:", _jsx("input", { ref: inputRef, type: "number", value: days, min: "1", onChange: (e) => setDays(parseInt(e.target.value) || 1), placeholder: "Number of days to snooze this note" })] }) })), _jsxs("div", Object.assign({ className: "reboarder-modal-buttons" }, { children: [_jsx("button", Object.assign({ onClick: onClose }, { children: "Cancel" })), _jsx("button", Object.assign({ onClick: handleSnooze, className: "mod-cta" }, { children: "Snooze" }))] }))] })) })));
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ3VzdG9tU25vb3plTW9kYWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJDdXN0b21Tbm9vemVNb2RhbC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxPQUFjLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFM0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLE9BQU8sQ0FBQztBQVNsQyxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBcUMsQ0FBQyxFQUNuRSxJQUFJLEVBQ0osTUFBTSxFQUNOLE9BQU8sRUFDUCxVQUFVLEVBQ1YsRUFBRSxFQUFFO0lBQ0osTUFBTSxNQUFNLEdBQUcsU0FBUyxFQUFFLENBQUM7SUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFtQixJQUFJLENBQUMsQ0FBQztJQUNoRCxvRkFBb0Y7SUFDcEYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFOUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtRQUNkLElBQUksTUFBTSxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUU7WUFDL0IsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUMxQjtJQUNGLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFYixTQUFTLENBQUMsR0FBRyxFQUFFO1FBQ2QsTUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFnQixFQUFFLEVBQUU7WUFDMUMsSUFBSSxDQUFDLE1BQU07Z0JBQUUsT0FBTztZQUVwQixJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssT0FBTyxFQUFFO2dCQUN0QixDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ25CLFlBQVksRUFBRSxDQUFDO2FBQ2Y7aUJBQU0sSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLFFBQVEsRUFBRTtnQkFDOUIsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUNuQixPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyw2QkFBNkI7Z0JBQ25ELE9BQU8sRUFBRSxDQUFDO2FBQ1Y7UUFDRixDQUFDLENBQUM7UUFFRixRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNyRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVuQixNQUFNLFlBQVksR0FBRyxHQUFTLEVBQUU7UUFDL0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLHdCQUF3QjtRQUNqRCxNQUFNLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JDLFVBQVUsRUFBRSxDQUFDO1FBQ2IsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDLENBQUEsQ0FBQztJQUVGLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFekIsT0FBTyxDQUNOLDRCQUFLLFNBQVMsRUFBQywwQkFBMEIsZ0JBQ3hDLDZCQUFLLFNBQVMsRUFBQyxpQkFBaUIsaUJBQy9CLHlDQUFzQixFQUN0Qiw0QkFBSyxTQUFTLEVBQUMseUJBQXlCLGdCQUN2QyxxQ0FFQyxnQkFDQyxHQUFHLEVBQUUsUUFBUSxFQUNiLElBQUksRUFBQyxRQUFRLEVBQ2IsS0FBSyxFQUFFLElBQUksRUFDWCxHQUFHLEVBQUMsR0FBRyxFQUNQLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUN2RCxXQUFXLEVBQUMsb0NBQW9DLEdBQy9DLElBQ0ssSUFDSCxFQUNOLDZCQUFLLFNBQVMsRUFBQyx5QkFBeUIsaUJBQ3ZDLCtCQUFRLE9BQU8sRUFBRSxPQUFPLDRCQUFpQixFQUN6QywrQkFBUSxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBQyxTQUFTLDRCQUV6QyxLQUNKLEtBQ0QsSUFDRCxDQUNOLENBQUM7QUFDSCxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZVJlZiwgdXNlRWZmZWN0IH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyB1c2VQbHVnaW4gfSBmcm9tICdob29rcyc7XG5cbmludGVyZmFjZSBDdXN0b21Tbm9vemVNb2RhbFByb3BzIHtcblx0ZmlsZTogVEZpbGU7XG5cdGlzT3BlbjogYm9vbGVhbjtcblx0b25DbG9zZTogKCkgPT4gdm9pZDtcblx0b25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IEN1c3RvbVNub296ZU1vZGFsOiBSZWFjdC5GQzxDdXN0b21Tbm9vemVNb2RhbFByb3BzPiA9ICh7IFxuXHRmaWxlLCBcblx0aXNPcGVuLCBcblx0b25DbG9zZSwgXG5cdG9uQ29tcGxldGVcbn0pID0+IHtcblx0Y29uc3QgcGx1Z2luID0gdXNlUGx1Z2luKCk7XG5cdGNvbnN0IGlucHV0UmVmID0gdXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xuXHQvLyBTdG9yZSBkYXlzIGJ1dCBpbml0aWFsaXplIGZyb20gZGVmYXVsdCBob3VycyAoY29udmVydCBob3VycyAtPiBkYXlzLCByb3VuZGluZyB1cClcblx0Y29uc3QgZGVmYXVsdERheXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwocGx1Z2luLnNldHRpbmdzLmRlZmF1bHRTbm9vemVIb3VycyAvIDI0KSk7XG5cdGNvbnN0IFtkYXlzLCBzZXREYXlzXSA9IHVzZVN0YXRlKGRlZmF1bHREYXlzKTtcblxuXHR1c2VFZmZlY3QoKCkgPT4ge1xuXHRcdGlmIChpc09wZW4gJiYgaW5wdXRSZWYuY3VycmVudCkge1xuXHRcdFx0aW5wdXRSZWYuY3VycmVudC5zZWxlY3QoKTtcblx0XHR9XG5cdH0sIFtpc09wZW5dKTtcblxuXHR1c2VFZmZlY3QoKCkgPT4ge1xuXHRcdGNvbnN0IGhhbmRsZUtleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKCFpc09wZW4pIHJldHVybjtcblx0XHRcdFxuXHRcdFx0aWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0aGFuZGxlU25vb3plKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHNldERheXMoZGVmYXVsdERheXMpOyAvLyBSZXNldCB0byBkZWZhdWx0IG9uIGNhbmNlbFxuXHRcdFx0XHRvbkNsb3NlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVLZXlEb3duKTtcblx0XHRyZXR1cm4gKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUtleURvd24pO1xuXHR9LCBbaXNPcGVuLCBkYXlzXSk7XG5cblx0Y29uc3QgaGFuZGxlU25vb3plID0gYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhvdXJzID0gZGF5cyAqIDI0OyAvLyBjb252ZXJ0IGRheXMgdG8gaG91cnNcblx0XHRhd2FpdCBwbHVnaW4uc25vb3plTm90ZShmaWxlLCBob3Vycyk7XG5cdFx0b25Db21wbGV0ZSgpO1xuXHRcdG9uQ2xvc2UoKTtcblx0fTtcblxuXHRpZiAoIWlzT3BlbikgcmV0dXJuIG51bGw7XG5cblx0cmV0dXJuIChcblx0XHQ8ZGl2IGNsYXNzTmFtZT1cInJlYm9hcmRlci1tb2RhbC1iYWNrZHJvcFwiPlxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItbW9kYWxcIj5cblx0XHRcdFx0PGgyPkN1c3RvbSBTbm9vemU8L2gyPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInJlYm9hcmRlci1tb2RhbC1jb250ZW50XCI+XG5cdFx0XHRcdFx0PGxhYmVsPlxuXHRcdFx0XHRcdFx0RGF5czpcblx0XHRcdFx0XHRcdDxpbnB1dFxuXHRcdFx0XHRcdFx0XHRyZWY9e2lucHV0UmVmfVxuXHRcdFx0XHRcdFx0XHR0eXBlPVwibnVtYmVyXCJcblx0XHRcdFx0XHRcdFx0dmFsdWU9e2RheXN9XG5cdFx0XHRcdFx0XHRcdG1pbj1cIjFcIlxuXHRcdFx0XHRcdFx0XHRvbkNoYW5nZT17KGUpID0+IHNldERheXMocGFyc2VJbnQoZS50YXJnZXQudmFsdWUpIHx8IDEpfVxuXHRcdFx0XHRcdFx0XHRwbGFjZWhvbGRlcj1cIk51bWJlciBvZiBkYXlzIHRvIHNub296ZSB0aGlzIG5vdGVcIlxuXHRcdFx0XHRcdFx0Lz5cblx0XHRcdFx0XHQ8L2xhYmVsPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJyZWJvYXJkZXItbW9kYWwtYnV0dG9uc1wiPlxuXHRcdFx0XHRcdDxidXR0b24gb25DbGljaz17b25DbG9zZX0+Q2FuY2VsPC9idXR0b24+XG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXtoYW5kbGVTbm9vemV9IGNsYXNzTmFtZT1cIm1vZC1jdGFcIj5cblx0XHRcdFx0XHRcdFNub296ZVxuXHRcdFx0XHRcdDwvYnV0dG9uPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdDwvZGl2PlxuXHQpO1xufTtcbiJdfQ==