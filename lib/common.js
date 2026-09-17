window._Blobz_ = window._Blobz_ || {};

_Blobz_.common = (() => {
    const parseDate = str => new Date(str);

    const updatedWhen = (now, then) => {
        const diff = Math.floor((now - then) / 1000);
        if (diff < 60) return `Updated ${diff} seconds ago`;
        if (diff < 3600) return `Updated ${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `Updated ${Math.floor(diff / 3600)} hours ago`;
        return `Updated ${Math.floor(diff / 86400)} days ago`;
    };

    return { parseDate, updatedWhen };
})();
