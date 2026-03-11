/**
 * Excel Image Injection Utility
 * Injects an image (logo) into an already-generated XLSX file
 * by manipulating the OpenXML zip structure using JSZip.
 */

import JSZip from 'jszip';

/**
 * Inject a PNG image into a specific sheet of an XLSX workbook.
 * The image is placed in the top-left area (rows 0-3, cols 0-1).
 *
 * @param xlsxBuffer - The raw XLSX file as ArrayBuffer
 * @param imageData  - The image as Uint8Array
 * @param sheetIndex - 0-based index of the target sheet (default 0 = first sheet)
 * @returns A Blob of the modified XLSX file
 */
export async function injectImageIntoXlsx(
  xlsxBuffer: ArrayBuffer,
  imageData: Uint8Array,
  sheetIndex: number = 0
): Promise<Blob> {
  const zip = await JSZip.loadAsync(xlsxBuffer);

  // 1. Add image file
  zip.file('xl/media/image1.png', imageData);

  // 2. Create drawing XML — positions the image from cell A1 to roughly B4
  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from>
      <xdr:col>0</xdr:col>
      <xdr:colOff>200000</xdr:colOff>
      <xdr:row>1</xdr:row>
      <xdr:rowOff>50000</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>2</xdr:col>
      <xdr:colOff>1500000</xdr:colOff>
      <xdr:row>6</xdr:row>
      <xdr:rowOff>100000</xdr:rowOff>
    </xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="Meridian Logo"/>
        <xdr:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="100000" y="50000"/>
          <a:ext cx="3500000" cy="700000"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
  zip.file('xl/drawings/drawing1.xml', drawingXml);

  // 3. Drawing relationships — links drawing to image
  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);

  // 4. Update or create sheet relationships to include the drawing
  const sheetNum = sheetIndex + 1;
  const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetNum}.xml.rels`;
  const drawingRel = `<Relationship Id="rId_drw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;

  const existingRels = zip.file(sheetRelsPath);
  if (existingRels) {
    let rels = await existingRels.async('string');
    if (!rels.includes('drawing1.xml')) {
      rels = rels.replace('</Relationships>', `${drawingRel}\n</Relationships>`);
    }
    zip.file(sheetRelsPath, rels);
  } else {
    zip.file(sheetRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${drawingRel}
</Relationships>`);
  }

  // 5. Add <drawing> reference to the sheet XML
  const sheetPath = `xl/worksheets/sheet${sheetNum}.xml`;
  const sheetFile = zip.file(sheetPath);
  if (sheetFile) {
    let sheetXml = await sheetFile.async('string');
    if (!sheetXml.includes('<drawing')) {
      // Insert before </worksheet> — but after <sheetData> and other elements
      sheetXml = sheetXml.replace('</worksheet>', '<drawing r:id="rId_drw1"/>\n</worksheet>');
      zip.file(sheetPath, sheetXml);
    }
  }

  // 6. Update [Content_Types].xml
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ct = await ctFile.async('string');
    if (!ct.includes('image/png')) {
      ct = ct.replace('</Types>', `<Default Extension="png" ContentType="image/png"/>\n</Types>`);
    }
    if (!ct.includes('drawing1.xml')) {
      ct = ct.replace('</Types>',
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>\n</Types>`);
    }
    zip.file('[Content_Types].xml', ct);
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Fetch the Meridian logo from the public assets and return as Uint8Array.
 */
export async function fetchLogoImageData(): Promise<Uint8Array | null> {
  try {
    const response = await fetch('/images/meridian-logo.png');
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}
