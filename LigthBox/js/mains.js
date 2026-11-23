document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('form-propina');
    const propinaInput = document.getElementById('propina-total');
    const nombreInput = document.getElementById('nombre');
    const horasInput = document.getElementById('horas-trabajadas');
    const resultado = document.getElementById('resultado');
    const participantes = document.getElementById('participantes');
    const historial = document.getElementById('historial');
    const formularioDescuento = document.getElementById('form-descuento');
    const listaDescuentos = document.getElementById('lista-descuentos');
    const personaDescuentoInput = document.getElementById('descuento-persona');
    const montoDescuentoInput = document.getElementById('descuento-monto');
    const fechaDescuentoInput = document.getElementById('descuento-fecha');
    const motivoDescuentoInput = document.getElementById('descuento-motivo');
    const botonReiniciar = document.getElementById('btn-reiniciar');
    const botonDescuentos = document.getElementById('btn-toggle-descuentos');
    const panelDescuentos = document.getElementById('panel-descuentos');
    const botonHistorial = document.getElementById('btn-toggle-historial');
    const panelHistorial = document.getElementById('panel-historial');

    const almacenamiento = 'calculadora-propinas';
    const formatoNumero = new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    let personas = [];
    let descuentos = [];
    let registrosHistorial = [];
    let propinaTotalFijada = null;
    
    

    fechaDescuentoInput.value = fechaLocalActual();
    cargarDatos();

    formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();

        const nombre = nombreInput.value.trim();
        const horas = Number(horasInput.value);
        const propinaTotal = convertirMonto(propinaInput.value);

        if (!nombre || !Number.isFinite(horas) || horas <= 0 ||
            !Number.isFinite(propinaTotal) || propinaTotal < 0 ||
            !esMontoValido(propinaInput.value)) {
            alert('Ingresa un nombre, una propina total válida y unas horas trabajadas válidas.');
            return;
        }

        if (propinaTotalFijada === null) {
            propinaTotalFijada = propinaTotal;
            propinaInput.value = formatearMontoEntrada(propinaTotal);
            propinaInput.disabled = true;
        }

        const nuevaPersona = { id: crearId(), nombre, horas };
        personas.push(nuevaPersona);
        if (calcularMontos() === null) {
            personas.pop();
            alert('No se puede agregar esta persona porque cambiaría el reparto y dejaría un descuento mayor que la propina disponible.');
            return;
        }

        registrosHistorial.push(`Se agregó a ${nombre} con ${horas} horas`);
        guardarDatos();
        renderizar();

        nombreInput.value = '';
        horasInput.value = '';
        nombreInput.focus();
    });

    formularioDescuento.addEventListener('submit', (evento) => {
        evento.preventDefault();

        const persona = personas.find(({ id }) => id === personaDescuentoInput.value);
        const monto = convertirMonto(montoDescuentoInput.value);
        const fecha = fechaDescuentoInput.value;
        const motivo = motivoDescuentoInput.value.trim();

        if (!persona || personas.length < 2 ||
            !Number.isFinite(monto) || monto <= 0 ||
            !esMontoValido(montoDescuentoInput.value) ||
            !fecha || !motivo) {
            alert('Selecciona a quién descontar e ingresa un monto válido, el día y el motivo. Debe haber al menos dos participantes.');
            return;
        }

        const montoCentavos = Math.round(monto * 100);
        descuentos.push({
            id: crearId(),
            personaId: persona.id,
            montoCentavos,
            fecha,
            motivo
        });

        if (calcularMontos() === null) {
            descuentos.pop();
            alert('El descuento no puede ser mayor que la propina disponible para esa persona.');
            return;
        }

        registrosHistorial.push(
            `Descuento de $${(montoCentavos / 100).toFixed(2)} a ${persona.nombre} el ${formatearFecha(fecha)}. Motivo: ${motivo}`
        );
        guardarDatos();
        formularioDescuento.reset();
        fechaDescuentoInput.value = fechaLocalActual();
        renderizar();
    });

    propinaInput.addEventListener('input', () => {
        if (propinaTotalFijada === null) {
            calcularPropinas();
        }
    });

    propinaInput.addEventListener('blur', () => {
        formatearCampoMonto(propinaInput);
    });

    montoDescuentoInput.addEventListener('blur', () => {
        formatearCampoMonto(montoDescuentoInput);
    });

    botonHistorial.addEventListener('click', () => {
        const abierto = botonHistorial.getAttribute('aria-expanded') !== 'true';
        panelHistorial.hidden = !abierto;
        botonHistorial.setAttribute('aria-expanded', String(abierto));
        botonHistorial.textContent = abierto ? 'Ocultar historial' : 'Mostrar historial';
    });

    botonDescuentos.addEventListener('click', () => {
        const abierto = botonDescuentos.getAttribute('aria-expanded') !== 'true';
        panelDescuentos.hidden = !abierto;
        botonDescuentos.setAttribute('aria-expanded', String(abierto));
        botonDescuentos.textContent = abierto ? 'Ocultar descuentos' : 'Mostrar descuentos';
    });

    botonReiniciar.addEventListener('click', reiniciarTodo);

    function reiniciarTodo() {
        personas = [];
        descuentos = [];
        registrosHistorial = [];
        propinaTotalFijada = null;

        localStorage.removeItem(almacenamiento);
        formulario.reset();
        formularioDescuento.reset();

        propinaInput.value = '';
        propinaInput.disabled = false;
        nombreInput.value = '';
        horasInput.value = '';
        montoDescuentoInput.value = '';
        motivoDescuentoInput.value = '';
        personaDescuentoInput.value = '';
        fechaDescuentoInput.value = fechaLocalActual();

        panelDescuentos.hidden = true;
        botonDescuentos.setAttribute('aria-expanded', 'false');
        botonDescuentos.textContent = 'Mostrar descuentos';

        panelHistorial.hidden = true;
        botonHistorial.setAttribute('aria-expanded', 'false');
        botonHistorial.textContent = 'Mostrar historial';

        renderizar();
        propinaInput.focus();
    }

    participantes.addEventListener('click', (evento) => {
        const boton = evento.target.closest('button[data-accion]');
        if (!boton) return;

        const indice = Number(boton.dataset.indice);
        if (!Number.isInteger(indice) || !personas[indice]) return;

        if (boton.dataset.accion === 'editar') {
            mostrarEdicion(indice);
        } else if (boton.dataset.accion === 'eliminar') {
            eliminarPersona(indice);
        }
    });

    function cargarDatos() {
        const datosGuardados = localStorage.getItem(almacenamiento);

        if (datosGuardados) {
            try {
                const datos = JSON.parse(datosGuardados);
                personas = Array.isArray(datos.personas) ? datos.personas : [];
                personas.forEach((persona) => {
                    if (!persona.id) persona.id = crearId();
                });
                descuentos = Array.isArray(datos.descuentos) ? datos.descuentos : [];
                propinaTotalFijada = Number.isFinite(datos.propinaTotal) ? datos.propinaTotal : null;
                registrosHistorial = Array.isArray(datos.historial)
                    ? datos.historial
                    : personas.map(persona => `Se agregó a ${persona.nombre} con ${persona.horas} horas`);

                if (propinaTotalFijada !== null) {
                    propinaInput.value = formatearMontoEntrada(propinaTotalFijada);
                    propinaInput.disabled = true;
                }
            } catch (error) {
                localStorage.removeItem(almacenamiento);
            }
        }

        renderizar();
    }

    function guardarDatos() {
        localStorage.setItem(almacenamiento, JSON.stringify({
            propinaTotal: propinaTotalFijada,
            personas,
            descuentos,
            historial: registrosHistorial
        }));
    }

    function renderizar() {
        participantes.replaceChildren();
        historial.replaceChildren();
        listaDescuentos.replaceChildren();
        resultado.replaceChildren();

        personas.forEach((persona, indice) => {
            const participante = document.createElement('li');
            participante.className = 'participante-item';

            const nombreParticipante = document.createElement('span');
            nombreParticipante.className = 'participante-desc';
            nombreParticipante.textContent = persona.nombre;

            const horasParticipante = document.createElement('span');
            horasParticipante.className = 'participante-hours';
            horasParticipante.textContent = `${persona.horas} horas`;

            const acciones = document.createElement('div');
            acciones.className = 'participante-acciones';
            acciones.append(
                crearBotonAccion('editar', 'Editar', persona.nombre, indice),
                crearBotonAccion('eliminar', 'Eliminar', persona.nombre, indice)
            );

            participante.append(nombreParticipante, horasParticipante, acciones);
            participantes.appendChild(participante);
        });

        const personaSeleccionada = personaDescuentoInput.value;
        personaDescuentoInput.replaceChildren();
        const opcionInicial = document.createElement('option');
        opcionInicial.value = '';
        opcionInicial.textContent = 'Selecciona un participante';
        personaDescuentoInput.appendChild(opcionInicial);

        personas.forEach((persona) => {
            const opcion = document.createElement('option');
            opcion.value = persona.id;
            opcion.textContent = persona.nombre;
            personaDescuentoInput.appendChild(opcion);
        });
        if (personas.some(persona => persona.id === personaSeleccionada)) {
            personaDescuentoInput.value = personaSeleccionada;
        }

        if (descuentos.length === 0) {
            const vacio = document.createElement('li');
            vacio.className = 'descuento-vacio';
            vacio.textContent = 'No hay descuentos registrados.';
            listaDescuentos.appendChild(vacio);
        } else {
            descuentos.forEach((descuento) => {
                const persona = personas.find(({ id }) => id === descuento.personaId);
                if (!persona) return;

                const registro = document.createElement('li');
                registro.className = 'descuento-item';

                const encabezado = document.createElement('strong');
                encabezado.textContent = `${persona.nombre}: -${formatearMonto(descuento.montoCentavos)}`;

                const comentario = document.createElement('small');
                comentario.textContent = `${formatearFecha(descuento.fecha)} · ${descuento.motivo}`;

                registro.append(encabezado, comentario);
                listaDescuentos.appendChild(registro);
            });
        }

        registrosHistorial.forEach((texto) => {
            const registro = document.createElement('li');
            registro.textContent = texto;
            historial.appendChild(registro);
        });

        calcularPropinas();
    }

    function crearBotonAccion(accion, texto, nombre, indice) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = `btn-participante btn-${accion}`;
        boton.dataset.accion = accion;
        boton.dataset.indice = String(indice);
        boton.setAttribute('aria-label', `${texto} a ${nombre}`);
        boton.textContent = texto;
        return boton;
    }

    function mostrarEdicion(indice) {
        const persona = personas[indice];
        const fila = participantes.children[indice];
        const formularioEdicion = document.createElement('form');
        formularioEdicion.className = 'participante-edicion';

        const nombreEditado = document.createElement('input');
        nombreEditado.type = 'text';
        nombreEditado.value = persona.nombre;
        nombreEditado.setAttribute('aria-label', 'Nombre del participante');
        nombreEditado.required = true;

        const horasEditadas = document.createElement('input');
        horasEditadas.type = 'number';
        horasEditadas.min = '0.01';
        horasEditadas.step = '0.01';
        horasEditadas.value = String(persona.horas);
        horasEditadas.setAttribute('aria-label', 'Horas trabajadas');
        horasEditadas.required = true;

        const guardar = document.createElement('button');
        guardar.type = 'submit';
        guardar.className = 'btn-participante btn-guardar';
        guardar.textContent = 'Guardar';

        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'btn-participante btn-cancelar';
        cancelar.textContent = 'Cancelar';
        cancelar.addEventListener('click', renderizar);

        formularioEdicion.append(nombreEditado, horasEditadas, guardar, cancelar);
        formularioEdicion.addEventListener('submit', (evento) => {
            evento.preventDefault();
            const nuevoNombre = nombreEditado.value.trim();
            const nuevasHoras = Number(horasEditadas.value);

            if (!nuevoNombre || !Number.isFinite(nuevasHoras) || nuevasHoras <= 0) {
                alert('Ingresa un nombre y unas horas trabajadas válidas.');
                return;
            }

            registrosHistorial.push(
                `Se actualizó a ${persona.nombre}: ${nuevoNombre}, ${nuevasHoras} horas`
            );
            const personaAnterior = personas[indice];
            personas[indice] = { ...personaAnterior, nombre: nuevoNombre, horas: nuevasHoras };
            if (calcularMontos() === null) {
                personas[indice] = personaAnterior;
                registrosHistorial.pop();
                alert('No se puede guardar el cambio porque dejaría un descuento mayor que la propina disponible.');
                return;
            }
            guardarDatos();
            renderizar();
        });

        fila.replaceChildren(formularioEdicion);
        nombreEditado.focus();
    }

    function eliminarPersona(indice) {
        const persona = personas[indice];
        if (!window.confirm(`¿Eliminar a ${persona.nombre} de los participantes?`)) return;

        const descuentosAnteriores = descuentos;
        const descuentosEliminados = descuentos.filter(descuento => descuento.personaId === persona.id);
        descuentos = descuentos.filter(descuento => descuento.personaId !== persona.id);
        personas.splice(indice, 1);
        if (personas.length > 0 && calcularMontos() === null) {
            personas.splice(indice, 0, persona);
            descuentos = descuentosAnteriores;
            alert('No se puede eliminar a esta persona porque afectaría los descuentos registrados de los demás participantes.');
            return;
        }

        if (descuentosEliminados.length > 0) {
            registrosHistorial.push(
                `Se quitaron ${descuentosEliminados.length} descuento(s) asociado(s) a ${persona.nombre}`
            );
        }
        registrosHistorial.push(`Se eliminó a ${persona.nombre}`);
        guardarDatos();
        renderizar();
    }

    function calcularPropinas() {
        const propinaTotal = propinaTotalFijada ?? convertirMonto(propinaInput.value);

        resultado.replaceChildren();

        if (!Number.isFinite(propinaTotal) || propinaTotal < 0 || personas.length === 0) {
            const elementoVacio = document.createElement('li');
            elementoVacio.className = 'participante-item';
            elementoVacio.textContent = '0.00';
            resultado.appendChild(elementoVacio);
            return;
        }

        const montos = calcularMontos();
        if (montos === null) {
            const error = document.createElement('li');
            error.textContent = 'No se puede calcular: revisa los descuentos registrados.';
            resultado.appendChild(error);
            return;
        }

        personas.forEach((persona) => {
            const elemento = document.createElement('li');
            elemento.className = 'participante-item';

            const nombreParticipante = document.createElement('span');
            nombreParticipante.className = 'participante-desc';
            nombreParticipante.textContent = persona.nombre;

            const montoParticipante = document.createElement('span');
            montoParticipante.className = 'participante-hours';
            montoParticipante.textContent = formatearMonto(montos.get(persona.id));

            elemento.append(nombreParticipante, montoParticipante);
            resultado.appendChild(elemento);
        });
    }

    function calcularMontos() {
        const propinaTotal = propinaTotalFijada ?? convertirMonto(propinaInput.value);
        if (!Number.isFinite(propinaTotal) || propinaTotal < 0 || personas.length === 0) return null;

        const montos = repartirCentavos(Math.round(propinaTotal * 100), personas);

        for (const descuento of descuentos) {
            const persona = personas.find(({ id }) => id === descuento.personaId);
            const destinatarios = personas.filter(({ id }) => id !== descuento.personaId);
            const montoDisponible = montos.get(descuento.personaId);

            if (!persona || destinatarios.length === 0 ||
                !Number.isInteger(descuento.montoCentavos) || descuento.montoCentavos <= 0 ||
                descuento.montoCentavos > montoDisponible) {
                return null;
            }

            montos.set(persona.id, montoDisponible - descuento.montoCentavos);
            const reparto = repartirCentavos(descuento.montoCentavos, destinatarios);
            reparto.forEach((monto, id) => {
                montos.set(id, montos.get(id) + monto);
            });
        }

        return montos;
    }

    function repartirCentavos(totalCentavos, destinatarios) {
        const totalHoras = destinatarios.reduce((total, persona) => total + persona.horas, 0);
        const montos = new Map();
        const restos = [];
        let centavosRepartidos = 0;

        destinatarios.forEach((persona, indice) => {
            const cuota = totalCentavos * persona.horas / totalHoras;
            const monto = Math.floor(cuota);
            montos.set(persona.id, monto);
            centavosRepartidos += monto;
            restos.push({ id: persona.id, resto: cuota - monto, indice });
        });

        restos.sort((a, b) => b.resto - a.resto || a.indice - b.indice);
        for (let indice = 0; indice < totalCentavos - centavosRepartidos; indice += 1) {
            const id = restos[indice].id;
            montos.set(id, montos.get(id) + 1);
        }

        return montos;
    }

    function formatearMonto(montoCentavos) {
        return `$${formatoNumero.format(montoCentavos / 100)}`;
    }



    function crearId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `id-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    }

    function fechaLocalActual() {
        const fecha = new Date();
        fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
        return fecha.toISOString().slice(0, 10);
    }

    function formatearFecha(fecha) {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function convertirMonto(valor) {
        const monto = valor.trim().replace(/^\$\s*/, '');
        if (!esMontoValido(monto)) {
            return NaN;
        }

        return Number(monto.replace(',', '.'));
    }

    function esMontoValido(valor) {
        return /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(
            valor.trim().replace(/^\$\s*/, '')
        );
    }

    function formatearMontoEntrada(monto) {
        return `$${monto.toFixed(2)}`;
    }

    function formatearCampoMonto(campo) {
        const monto = convertirMonto(campo.value);
        if (Number.isFinite(monto)) {
            campo.value = formatearMontoEntrada(monto);
        }
    }
});
