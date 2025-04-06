/**
 * Utility for exporting table data to PDF
 * Requires jsPDF and jspdf-autotable libraries
 */

async function exportToPdf(options) {
    // Check if required libraries are loaded
    if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
        await loadJsPDF();
    }
    
    const { jsPDF } = jspdf;
    const { autoTable } = window;
    
    if (!jsPDF || !autoTable) {
        throw new Error('Required PDF libraries not available');
    }
    
    const { title, columns, data } = options;
    
    // Create PDF document
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    // Add date
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Prepare table columns and data
    const tableColumns = columns.map(column => ({
        header: column.title,
        dataKey: column.field
    }));
    
    // Format data for the table
    const tableData = data.map(record => {
        const row = {};
        
        columns.forEach(column => {
            // Get value based on field path (supports nested properties)
            let value = record;
            const fieldParts = column.field.split('.');
            
            for (const part of fieldParts) {
                if (value === null || value === undefined) break;
                value = value[part];
            }
            
            // Format value based on column type
            if (value === null || value === undefined) {
                row[column.field] = '-';
            } else if (column.type === 'date' && value) {
                row[column.field] = new Date(value).toLocaleDateString();
            } else if (column.type === 'datetime' && value) {
                row[column.field] = new Date(value).toLocaleString();
            } else if (column.type === 'boolean') {
                row[column.field] = value ? 'Yes' : 'No';
            } else if (column.type === 'status') {
                row[column.field] = value;
            } else {
                row[column.field] = value;
            }
        });
        
        return row;
    });
    
    // Add table to document
    autoTable(doc, {
        startY: 40,
        columns: tableColumns,
        body: tableData,
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240]
        },
        margin: { top: 40 },
        styles: { overflow: 'linebreak' },
        theme: 'grid'
    });
    
    // Add page numbers
    const pageCount = doc.internal.pages.length;
    for (let i = 1; i < pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount - 1}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
    }
    
    // Save the PDF
    doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function loadJsPDF() {
    return new Promise((resolve, reject) => {
        // Load jsPDF script
        const jsPdfScript = document.createElement('script');
        jsPdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jsPdfScript.async = true;
        jsPdfScript.onload = () => {
            // Load AutoTable plugin
            const autoTableScript = document.createElement('script');
            autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js';
            autoTableScript.async = true;
            autoTableScript.onload = resolve;
            autoTableScript.onerror = reject;
            document.head.appendChild(autoTableScript);
        };
        jsPdfScript.onerror = reject;
        document.head.appendChild(jsPdfScript);
    });
}

// Export for use in other files
window.exportToPdf = exportToPdf;
export default exportToPdf;