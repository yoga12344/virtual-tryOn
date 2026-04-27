
import streamlit as st
import os
import base64
import json
from services.gemini_service import analyze_try_on, generate_virtual_try_on_image

# Page Config
st.set_page_config(
    page_title="Fashion Unlimited | Neural Studio",
    page_icon="♾️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Professional CSS Injection
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    
    :root {
        --bg-color: #020617;
        --card-bg: rgba(15, 23, 42, 0.6);
        --accent: #3b82f6;
    }

    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
        background-color: var(--bg-color);
        color: #f8fafc;
    }
    
    .stApp { background-color: var(--bg-color); }
    
    .dashboard-card {
        background: var(--card-bg);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.5rem;
        padding: 2rem;
        margin-bottom: 1.5rem;
    }

    .stButton>button {
        width: 100%;
        border-radius: 1rem !important;
        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
        color: white !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.15em !important;
        padding: 1rem !important;
    }

    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# Main Studio Workspace
col_lab, col_canvas = st.columns([1, 1.5], gap="large")

with col_lab:
    st.markdown('<div class="dashboard-card">', unsafe_allow_html=True)
    st.markdown('### 🛠️ Workspace')
    gender = st.radio("Target Gender", ["MEN", "WOMEN"], horizontal=True)
    
    person_img = st.file_uploader("Upload Portrait", type=['jpg', 'jpeg', 'png'], key="p_up")
    top_img = st.file_uploader("Upload Top Asset", type=['jpg', 'jpeg', 'png'], key="t_up")
    bottom_img = st.file_uploader("Upload Bottom Asset", type=['jpg', 'jpeg', 'png'], key="b_up")
    
    dress_img = None
    if gender == "WOMEN":
        dress_img = st.file_uploader("Upload Dress Asset", type=['jpg', 'jpeg', 'png'], key="d_up")

    if st.button("EXECUTE NEURAL SYNTHESIS"):
        if not (person_img and (top_img or bottom_img or dress_img)):
            st.warning("Please upload a person and at least one garment asset.")
        else:
            try:
                def to_b64(f):
                    return base64.b64encode(f.getvalue()).decode() if f else None
                
                p_b64 = to_b64(person_img)
                t_b64 = to_b64(top_img)
                b_b64 = to_b64(bottom_img)
                d_b64 = to_b64(dress_img)
                
                with st.status("Initializing Hybrid Pipeline...", expanded=True) as status:
                    st.write("Step 1: Running CV (YOLOv8 + MediaPipe)...")
                    analysis = analyze_try_on(p_b64, t_b64, b_b64, d_b64, gender)
                    
                    st.write("Step 2: Analysis Complete. Generating Virtual Try-On...")
                    result_img = generate_virtual_try_on_image(
                        p_b64, t_b64, b_b64, d_b64,
                        analysis['technicalPrompt'], 
                        analysis.get('bodySize', 'M'), 
                        gender
                    )
                    
                    if result_img:
                        st.session_state.result = {"image": result_img, "analysis": analysis}
                        status.update(label="Synthesis Complete", state="complete")
                    else:
                        st.error("Neural Synthesis returned an empty result. Check API quotas or safety filters.")
                        status.update(label="Synthesis Failed", state="error")
            except Exception as e:
                st.error(f"System Error: {str(e)}")
    st.markdown('</div>', unsafe_allow_html=True)

with col_canvas:
    tabs = st.tabs(["[ CANVAS ]", "[ TELEMETRY ]"])
    with tabs[0]:
        if "result" in st.session_state and st.session_state.result:
            st.image(st.session_state.result['image'], use_container_width=True)
            if st.button("RESET CANVAS"):
                del st.session_state.result
                st.rerun()
        else:
            st.info("Awaiting input signal to begin synthesis.")
    with tabs[1]:
        if "result" in st.session_state and st.session_state.result:
            st.markdown("#### CV Grounding Data")
            st.json(st.session_state.result['analysis'].get('cv_telemetry', {}))
            st.markdown("#### Neural Analysis Output")
            st.json(st.session_state.result['analysis'])
